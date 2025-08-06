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

    # Si les champs 'item_code' ou 'name' sont dans fields, on peut récupérer infos liées
    # Par exemple stock, prix, si demandé dans les champs
    # (ici un exemple simple)

    # Récup stock_reel et prix_standard
    for item in items:
        # Stock réel = somme des actual_qty dans Bin pour cet item
        bins = frappe.db.get_all(
            "Bin",
            filters={"item_code": item.get("name")},
            fields=["actual_qty"]
        )
        item["stock_reel"] = sum([b.actual_qty for b in bins]) if bins else 0

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
        item["prix_standard"] = price or 0

    return items
