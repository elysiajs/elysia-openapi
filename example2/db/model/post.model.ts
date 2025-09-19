import { relations } from 'drizzle-orm';
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { usersTable } from './user.model';




export const postTable = sqliteTable('posts', {
	id: int().primaryKey({ autoIncrement: true }),
	userId: int()
		.notNull()
		.references(() => usersTable.id),
	title: text().notNull(),
	content: text().notNull(),
	createdAt: int()
		.notNull()
		.$defaultFn(() => Date.now()),
	updatedAt: int()
		.notNull()
		.$defaultFn(() => Date.now())
})



export const postsRelations = relations(postTable, ({ one }) => ({
	user: one(usersTable, {
		fields: [postTable.userId],
		references: [usersTable.id]
	})
}))