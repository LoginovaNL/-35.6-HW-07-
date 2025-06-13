import { Request, Response, Router } from "express";
import { IAuthRequisites } from "@Shared/types";
import { connection } from "../../index";
import { IUserRequisitesEntity } from "../../types";

export const authRouter = Router();

authRouter.post('/', async (
  req: Request<{}, {}, IAuthRequisites>,
  res: Response
) => {
  const { username, password } = req.body;
  const [data] = await connection.query<IUserRequisitesEntity[]>(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password]
  );

  if (!data?.length) {
    res.status(404);
  }

  res.send();
});