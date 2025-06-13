import { Router } from "express";

const router = Router();

router.get('/new-product', (req, res) => {
  res.render('admin/new-product'); 
});

router.post('/create-product', (req, res) => {
  const { name, description, price } = req.body;

  const newId = Date.now().toString(); 

  res.redirect(`/admin/${newId}`);
});

export default router;