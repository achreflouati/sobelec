@frappe.whitelist()
def get_item_price(item_code, price_list="Vente standard"):
	if not item_code:
		frappe.throw("Item Code is required")

	item_price = frappe.get_value("Item Price", {
		"item_code": item_code,
		"selling": 1,
		"price_list": price_list
	}, "price_list_rate") or 0

	return {"item_code": item_code, "price_list": price_list, "selling_price": item_price}
