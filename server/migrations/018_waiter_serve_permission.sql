-- Serving a ready order does not grant kitchen preparation or cancellation authority.
INSERT INTO public.permissions(id,module,description) VALUES('order:serve','ORDER','Serve ready orders in authorized outlets') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id) SELECT id,'order:serve' FROM public.roles WHERE id IN ('WAITER','WAITER_MANAGER') ON CONFLICT DO NOTHING;
