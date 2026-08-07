import { z } from "zod";

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, "タグ名を入力してください。")
  .max(40, "タグ名は40文字以内で入力してください。");
