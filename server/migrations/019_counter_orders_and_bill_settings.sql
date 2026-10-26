-- Add a real counter-order domain without creating synthetic tables or sittings.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS ck_orders_source;
ALTER TABLE public.orders ADD CONSTRAINT ck_orders_source CHECK(order_source IN ('CUSTOMER_QR','WAITER_POS','ROOM_SERVICE','COUNTER_POS'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS ck_orders_source_integrity;
ALTER TABLE public.orders ADD CONSTRAINT ck_orders_source_integrity CHECK(
 (order_source IN ('CUSTOMER_QR','WAITER_POS') AND dining_session_id IS NOT NULL AND hotel_stay_id IS NULL AND room_id IS NULL)
 OR (order_source='ROOM_SERVICE' AND dining_session_id IS NULL AND hotel_stay_id IS NOT NULL AND room_id IS NOT NULL)
 OR (order_source='COUNTER_POS' AND dining_session_id IS NULL AND hotel_stay_id IS NULL AND room_id IS NULL));
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS calculation_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS line_discount_paise BIGINT NOT NULL DEFAULT 0 CHECK(line_discount_paise>=0);
INSERT INTO public.permissions(id,module,description) VALUES('order:counter_create','ORDER','Create canonical counter orders'),('bill:approve_discount','BILLING','Review another staff member discount request') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id) SELECT id,'order:counter_create' FROM public.roles WHERE id IN ('CASHIER','RESTAURANT_MANAGER','RESTAURANT_OWNER') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id) SELECT id,'bill:approve_discount' FROM public.roles WHERE id IN ('WAITER_MANAGER','RESTAURANT_MANAGER','RESTAURANT_OWNER') ON CONFLICT DO NOTHING;
