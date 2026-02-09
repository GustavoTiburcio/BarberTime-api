CREATE SCHEMA "public";
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"date" date NOT NULL,
	"time" time NOT NULL,
	"service_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bookings_status_check" CHECK (CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text]))))
);
CREATE TABLE "professionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"avatar" text,
	"specialties" text[] DEFAULT '{}' NOT NULL,
	"rating" numeric(2, 1) DEFAULT '5.0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"username" varchar(50) CONSTRAINT "professionals_username_key" UNIQUE,
	"password_hash" text,
	"role" varchar(20) DEFAULT 'employee',
	"comission" numeric DEFAULT '0'
);
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"description" text,
	"duration" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "bookings" ADD CONSTRAINT "fk_professional" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id");
ALTER TABLE "bookings" ADD CONSTRAINT "fk_service" FOREIGN KEY ("service_id") REFERENCES "services"("id");
CREATE UNIQUE INDEX "bookings_pkey" ON "bookings" ("id");
CREATE INDEX "idx_bookings_date" ON "bookings" ("date");
CREATE INDEX "idx_bookings_professional" ON "bookings" ("professional_id");
CREATE INDEX "idx_bookings_status" ON "bookings" ("status");
CREATE UNIQUE INDEX "unique_confirmed_booking" ON "bookings" ("professional_id","date","time");
CREATE UNIQUE INDEX "professionals_pkey" ON "professionals" ("id");
CREATE UNIQUE INDEX "professionals_username_key" ON "professionals" ("username");
CREATE UNIQUE INDEX "services_pkey" ON "services" ("id");