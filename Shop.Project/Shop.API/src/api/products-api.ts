import { Request, Response, Router } from "express";
import { connection } from "../../index";
import { v4 as uuidv4 } from 'uuid';
import { OkPacket } from "mysql2";
import mysql, { RowDataPacket } from 'mysql2/promise';
import { enhanceProductsComments, enhanceProductsImages, getProductsFilterQuery } from "../helpers";
import {
  ICommentEntity,
  ImagesRemovePayload,
  IProductEntity,
  IProductImageEntity,
  IProductSearchFilter,
  ProductAddImagesPayload,
  ProductCreatePayload
} from "../../types";
import { mapCommentsEntity, mapImagesEntity, mapProductsEntity } from "../services/mapping";
import {
  DELETE_IMAGES_QUERY,
  INSERT_PRODUCT_IMAGES_QUERY,
  INSERT_PRODUCT_QUERY,
  REPLACE_PRODUCT_THUMBNAIL, UPDATE_PRODUCT_FIELDS
} from "../services/queries";

import { body, param, validationResult } from 'express-validator';

export const productsRouter = Router();

const throwServerError = (res: Response, e: Error) => {
  console.debug(e.message);
  res.status(500);
  res.send("Something went wrong");
}

productsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const [productRows] = await connection.query<IProductEntity[]>("SELECT * FROM products");
    const [commentRows] = await connection.query<ICommentEntity[]>("SELECT * FROM comments");
    const [imageRows] = await connection.query<IProductImageEntity[]>("SELECT * FROM images");

    const products = mapProductsEntity(productRows);
    const withComments = enhanceProductsComments(products, commentRows);
    const withImages = enhanceProductsImages(withComments, imageRows)

    res.send(withImages);
  } catch (e) {
    throwServerError(res, e);
  }
});

productsRouter.get('/search', async (
  req: Request<{}, {}, {}, IProductSearchFilter>,
  res: Response
) => {
  try {
    const [query, values] = getProductsFilterQuery(req.query);
    const [rows] = await connection.query<IProductEntity[]>(query, values);

    if (!rows?.length) {
      res.send([]);
      return;
    }

    const [commentRows] = await connection.query<ICommentEntity[]>("SELECT * FROM comments");
    const [imageRows] = await connection.query<IProductImageEntity[]>("SELECT * FROM images");

    const products = mapProductsEntity(rows);
    const withComments = enhanceProductsComments(products, commentRows);
    const withImages = enhanceProductsImages(withComments, imageRows)

    res.send(withImages);
  } catch (e) {
    throwServerError(res, e);
  }
});

productsRouter.get('/:id', async (
  req: Request<{ id: string }>,
  res: Response
) => {
  try {
    const [rows] = await connection.query<IProductEntity[]>(
      "SELECT * FROM products WHERE product_id = ?",
      [req.params.id]
    );

    if (!rows?.[0]) {
      res.status(404);
      res.send(`Product with id ${req.params.id} is not found`);
      return;
    }

    const [comments] = await connection.query<ICommentEntity[]>(
      "SELECT * FROM comments WHERE product_id = ?",
      [req.params.id]
    );

    const [images] = await connection.query<IProductImageEntity[]>(
      "SELECT * FROM images WHERE product_id = ?",
      [req.params.id]
    );

    const product = mapProductsEntity(rows)[0];

    if (comments.length) {
      product.comments = mapCommentsEntity(comments);
    }

    if (images.length) {
      product.images = mapImagesEntity(images);
      product.thumbnail = product.images.find(image => image.main) || product.images[0];
    }

    res.send(product);
  } catch (e) {
    throwServerError(res, e);
  }
});

productsRouter.post('/', async (
  req: Request<{}, {}, ProductCreatePayload>,
  res: Response
) => {
  try {
    const { title, description, price, images } = req.body;
    const productId = uuidv4();

    await connection.query<OkPacket>(
      INSERT_PRODUCT_QUERY,
      [productId, title || null, description || null, price || null]
    );

    if (images && images.length > 0) {
      const values = images.map((image) => [uuidv4(), image.url, productId, image.main]);
      await connection.query<OkPacket>(INSERT_PRODUCT_IMAGES_QUERY, [values]);
    }

    const [rows] = await connection.query<IProductEntity[]>(
      "SELECT * FROM products WHERE product_id = ?",
      [productId]
    );

    if (!rows?.[0]) {
      return res.status(500).send("Failed to retrieve created product");
    }

    const product = mapProductsEntity(rows)[0];

    const [comments] = await connection.query<ICommentEntity[]>(
      "SELECT * FROM comments WHERE product_id = ?",
      [productId]
    );
    const [imagesRows] = await connection.query<IProductImageEntity[]>(
      "SELECT * FROM images WHERE product_id = ?",
      [productId]
    );

    if (comments.length) {
      product.comments = mapCommentsEntity(comments);
    }

    if (imagesRows.length) {
      product.images = mapImagesEntity(imagesRows);
      product.thumbnail = product.images.find(image => image.main) || product.images[0];
    }
    res.status(201).json(product);
  } catch (e) {
    throwServerError(res, e);
  }
});


productsRouter.delete('/:id', async (
  req: Request<{ id: string }>,
  res: Response
) => {
  try {
    const [rows] = await connection.query<IProductEntity[]>(
      "SELECT * FROM products WHERE product_id = ?",
      [req.params.id]
    );

    if (!rows?.[0]) {
      res.status(404).send(`Product with id ${req.params.id} is not found`);
      return;
    }

    await connection.query<OkPacket>(
      "DELETE FROM images WHERE product_id = ?",
      [req.params.id]
    );

    await connection.query<OkPacket>(
      "DELETE FROM comments WHERE product_id = ?",
      [req.params.id]
    );

    await connection.query<OkPacket>(
      "DELETE FROM products WHERE product_id = ?",
      [req.params.id]
    );

    res.status(200).end();
  } catch (e) {
    throwServerError(res, e);
  }
});

productsRouter.get('/:id/similar', [
  param('id').isString().notEmpty(),
], async (req: Request<{ id: string }>, res: Response) => {
try {
const errors=validationResult(req);
if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

const productId=req.params.id;


const [productRows]=await connection.query<IProductEntity[]>(
"SELECT * FROM products WHERE product_id= ?",[productId]
);

if (!productRows?.[0]) return res.status(404).send(`Product with id ${productId} not found`);

interface SimilarProduct extends RowDataPacket {
  similar_product_id: string;
}

const [relatedRows] = await connection.query<SimilarProduct[]>(
  'SELECT similar_product_id FROM product_similarities WHERE product_id = ?',
  [productId]
);

const relatedIds = relatedRows.map(r => r.similar_product_id);

if (relatedIds.length===0) return res.json([]);


const placeholders=relatedIds.map(()=>'?').join(',');
const [relatedProducts]=await connection.query<IProductEntity[]>(
`SELECT * FROM products WHERE product_id IN (${placeholders})`,
relatedIds
);

res.json(mapProductsEntity(relatedProducts));
} catch(e){
throwServerError(res,e);
}
});


productsRouter.post('/add-similar', [
body('relations').isArray({ min:1 }),
body('relations.*.productId').isString().notEmpty(),
body('relations.*.similarProductId').isString().notEmpty(),
], async (req: Request<{}, {}, { relations:{productId:string; similarProductId:string;}[] }>, res: Response)=>{
try{
const errors=validationResult(req);
if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

const { relations }=req.body;

for(const rel of relations){

	await Promise.all([
		connection.query<OkPacket>(
			`INSERT IGNORE INTO product_similarities (product_id, similar_product_id) VALUES (?, ?)`,
			[rel.productId, rel.similarProductId]
		),
		connection.query<OkPacket>(
			`INSERT IGNORE INTO product_similarities (product_id, similar_product_id) VALUES (?, ?)`,
			[rel.similarProductId, rel.productId]
		)
	]);
}

res.status(201).send('Similar products added successfully');
}catch(e){
throwServerError(res,e);
}
});


productsRouter.post('/remove-similar', [
body('productIds').isArray({ min:1 }),
body('productIds.*').isString().notEmpty(),
], async (req: Request<{}, {}, { productIds:string[] }>, res: Response)=>{
try{
const errors=validationResult(req);
if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

const { productIds }=req.body;

await Promise.all([
	connection.query<OkPacket>(
	`DELETE FROM product_similarities WHERE product_id IN (${productIds.map(()=>'?').join(',')}) OR similar_product_id IN (${productIds.map(()=>'?').join(',')})`,
	[...productIds,...productIds]
	)
]);

res.send('Similar links removed successfully');
}catch(e){
throwServerError(res,e);
}
});