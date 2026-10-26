PALI VILLAGE MENU STAGING PACKAGE

Contains all menu dishes, category, section, price in INR/paise and supplied photos.
This is a staging import SOURCE PACKAGE, not an automated database migration.
Do NOT delete menu_items/outlet_menu_items rows: orders and billing may reference existing item IDs.
Inspect deployed schema, back up staging DB, reconcile item mapping and use transactional create/update/deactivate instead.
Missing photos are indicated in menu.csv and must show neutral placeholder in UI.
Prices are transcribed from user-supplied menu and not independently GST verified.
Do not expose credentials or deploy directly to production.
