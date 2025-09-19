import { relations } from 'drizzle-orm';
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { postTable } from './post.model';
import z from 'zod';

// 1. Drizzle 表定义
export const usersTable = sqliteTable('users', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  bio: text(),
  createdAt: int()
    .notNull()
    .$defaultFn(() => Date.now())
})



// 2. Zod Schema（基于 Drizzle 表生成，并可扩展校验）
export const selectUsersSchema = createSelectSchema(usersTable);
export const insertUsersSchema = createInsertSchema(usersTable);
export const updateUsersSchema = createUpdateSchema(usersTable)




// 3. 类型定义（可选，但推荐） 导出 TypeScript 类型（方便路由、service 等使用）

export const usersModel = {
  insertUsersDto: insertUsersSchema
    .omit({ id: true, createdAt: true })
    .describe('创建用户请求'),
  updateUsersDto: updateUsersSchema.omit({ id: true, createdAt: true }),
  selectUsersTable: selectUsersSchema
    .describe('用户信息响应')
}
export const usersRelations = relations(usersTable, ({ many }) => ({
  posts: many(postTable)
}))

export type SelectUsersTable = z.infer<typeof usersModel.selectUsersTable>
