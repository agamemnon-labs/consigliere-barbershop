-- Data only: the three branches get their real names (2026-11-23). Rows keep their ids, so
-- queues, shifts, sales and staff stay attached. A fresh database has no rows yet; the seed
-- inserts the new names there.
UPDATE "branches" SET "slug" = 'pulau-kalimantan', "name" = 'Jl. Pulau Kalimantan', "address" = 'Jl. Pulau Kalimantan, Samarinda' WHERE "slug" = 'juanda';--> statement-breakpoint
UPDATE "branches" SET "slug" = 'belatuk', "name" = 'Jl. Belatuk', "address" = 'Jl. Belatuk, Samarinda' WHERE "slug" = 'pramuka';--> statement-breakpoint
UPDATE "branches" SET "slug" = 'citra-niaga', "name" = 'Citra Niaga', "address" = 'Kawasan Citra Niaga, Samarinda' WHERE "slug" = 'tepian';--> statement-breakpoint
UPDATE "users" SET "email" = 'kasir.kalimantan@consigliere.test' WHERE "email" = 'kasir.juanda@consigliere.test';--> statement-breakpoint
UPDATE "users" SET "email" = 'kasir.belatuk@consigliere.test' WHERE "email" = 'kasir.pramuka@consigliere.test';--> statement-breakpoint
UPDATE "users" SET "email" = 'kasir.citraniaga@consigliere.test' WHERE "email" = 'kasir.tepian@consigliere.test';
