import frappe
from frappe import _
@frappe.whitelist()
def get_item_details(item_code):
	if not item_code:
		frappe.throw("Item Code is required")

	fields = [
		"item_name", "custom_référence_fournisseur", "custom_emplacement",
		"custom_désignation_longue_l11", "custom_code_comptable",
		"custom_devise", "image", "stock_uom"
	]

	item_data = frappe.get_value("Item", {"name": item_code}, fields, as_dict=True)

	if not item_data:
		frappe.throw(f"Item '{item_code}' not found")

	return item_data
