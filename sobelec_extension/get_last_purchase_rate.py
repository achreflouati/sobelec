import frappe
from frappe import _
@frappe.whitelist()
def get_last_purchase_rate(item_code):
	if not item_code:
		frappe.throw("Item Code is required")

	last_price = frappe.db.get_value(
		"Purchase Receipt Item",
		{"item_code": item_code},
		"base_rate",
		order_by="creation DESC"
	)

	return {"item_code": item_code, "last_purchase_rate": last_price or 0}
