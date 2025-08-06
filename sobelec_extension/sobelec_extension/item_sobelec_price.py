import frappe

def before_save_item(doc, method):
    price = frappe.db.get_value(
        "Item Price",
        {
            "item_code": doc.name,
            "price_list": "Vente standard",
            "selling": 1
        },
        "price_list_rate"
    )
    doc.custom_prix_de_vente = price or 0
    if doc.custom_prix_de_vente < 0:
        frappe.throw("Le prix de vente ne peut pas être négatif.")
    # doc.custom_prix_de_vente = round(doc.custom_prix_de_vente, 2)
    # doc.custom_prix_de_vente = frappe.utils.flt(doc.custom_prix_de_vente, 2)





def update_item_price_on_change(doc, method):
    if doc.selling and doc.price_list == "Vente standard":
        item = frappe.get_doc("Item", doc.item_code)
        item.custom_prix_de_vente = doc.price_list_rate
        item.save(ignore_permissions=True)
    doc.custom_prix_de_vente = frappe.utils.flt(doc.custom_prix_de_vente, 2)
    frappe.db.set_value("Item", doc.item_code, "custom_prix_de_vente", doc.custom_prix_de_vente)
    frappe.db.commit()
    frappe.msgprint(f"Prix de vente mis à jour pour l'article {doc.item_code}: {doc.custom_prix_de_vente}")
