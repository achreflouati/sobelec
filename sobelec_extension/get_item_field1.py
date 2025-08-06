import frappe
from frappe import _
@frappe.whitelist()
def get_item_fields():
    meta = frappe.get_meta("Item")
    fields = []
    for df in meta.fields:
        if not df.hidden and df.fieldname != "name":
            fields.append({
                "fieldname": df.fieldname,
                "label": df.label,
                "fieldtype": df.fieldtype
            })
    return fields


@frappe.whitelist()
def get_custom_item_list(fields=None, limit=50, start=0):
    limit = int(limit)
    start = int(start)

    # Si fields est une chaîne JSON, la parser
    import json
    if fields:
        try:
            fields = json.loads(fields)
        except Exception:
            # En cas d'erreur on utilise un sous-ensemble par défaut
            fields = ["name", "item_name"]
    else:
        fields = ["name", "item_name"]

    # On ajoute toujours le champ 'name' (clé primaire)
    if "name" not in fields:
        fields.append("name")

    # Récupérer items
    items = frappe.db.get_all(
        "Item",
        fields=fields,
        limit_start=start,
        limit_page_length=limit
    )

    # Ajouter des champs calculés : stock_reel, price_list_rate
    for item in items:
        # Stock réel = somme des actual_qty dans Bin pour cet item
        bins = frappe.db.get_all(
            "Bin",
            filters={"item_code": item.get("name")},
            fields=["actual_qty"]
        )
        item["stock_reel"] = sum([b["actual_qty"] for b in bins]) if bins else 0

        # Prix standard = premier prix vente trouvé dans Item Price (price_list="Standard Selling")
        price = frappe.db.get_value(
            "Item Price",
            filters={
                "item_code": item.get("name"),
                "price_list": "Standard Selling",
                "selling": 1
            },
            fieldname="price_list_rate"
        )
        item["price_list_rate"] = price or 0

    return items
