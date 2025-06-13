import { RowDataPacket } from "mysql2/index";
import { IAuthRequisites, IComment, IProduct, IProductFilterPayload, IProductImage } from "@Shared/types";

export type CommentCreatePayload = Omit<IComment, "id">;

export interface ICommentEntity extends RowDataPacket {
  comment_id: string;
  name: string;
  email: string;
  body: string;
  product_id: string;
}

export interface IProductEntity extends IProduct, RowDataPacket {
  product_id: string;
}

export interface IProductSearchFilter extends IProductFilterPayload {}

export type ImageCreatePayload = Omit<IProductImage, "id" | "productId">;

export type ProductCreatePayload =
  Omit<IProduct, "id" | "comments" | "thumbnail" | "images"> & { images: ImageCreatePayload[] };

export interface IProductImageEntity extends RowDataPacket {
  image_id: string;
  url: string;
  product_id: string;
  main: number;
}

export interface ProductAddImagesPayload {
  productId: string;
  images: ImageCreatePayload[];
}

export type ImagesRemovePayload = string[];

export interface IUserRequisitesEntity extends IAuthRequisites, RowDataPacket {
  id: number;
}