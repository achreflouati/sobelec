#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sobelec Extension - Script de test complet
Teste toutes les APIs et fonctionnalités
"""

import frappe
import json
from datetime import datetime
import traceback

def test_all_apis():
    """Test complet de toutes les APIs Sobelec"""
    
    print("=" * 80)
    print("DÉBUT DES TESTS SOBELEC EXTENSION")
    print("=" * 80)
    
    # Initialisation Frappe
    if not frappe.db:
        frappe.init(site='sobelec-erpnext')
        frappe.connect()
    
    test_results = {
        "timestamp": datetime.now().isoformat(),
        "tests": [],
        "success_count": 0,
        "error_count": 0
    }
    
    # Liste des tests à effectuer
    tests = [
        ("Health Check", test_health_check),
        ("Filter Options", test_filter_options),
        ("Search Items Basic", test_search_items_basic),
        ("Search Items Advanced", test_search_items_advanced),
        ("Item Complete Details", test_item_complete_details),
        ("Item Stock Details", test_item_stock_details),
        ("Legacy APIs", test_legacy_apis),
        ("Performance Test", test_performance),
        ("Error Handling", test_error_handling)
    ]
    
    for test_name, test_function in tests:
        print(f"\n{'='*60}")
        print(f"TEST: {test_name}")
        print(f"{'='*60}")
        
        try:
            result = test_function()
            test_results["tests"].append({
                "name": test_name,
                "status": "SUCCESS",
                "result": result,
                "error": None
            })
            test_results["success_count"] += 1
            print(f"✅ {test_name}: RÉUSSI")
            
        except Exception as e:
            error_details = {
                "message": str(e),
                "traceback": traceback.format_exc()
            }
            test_results["tests"].append({
                "name": test_name,
                "status": "ERROR",
                "result": None,
                "error": error_details
            })
            test_results["error_count"] += 1
            print(f"❌ {test_name}: ÉCHEC")
            print(f"   Erreur: {str(e)}")
    
    # Résumé final
    print(f"\n{'='*80}")
    print("RÉSUMÉ DES TESTS")
    print(f"{'='*80}")
    print(f"Total tests: {len(tests)}")
    print(f"Réussis: {test_results['success_count']}")
    print(f"Échecs: {test_results['error_count']}")
    print(f"Taux de réussite: {(test_results['success_count']/len(tests)*100):.1f}%")
    
    return test_results

def test_health_check():
    """Test du health check"""
    from sobelec_extension.api_consolidated import health_check
    result = health_check()
    
    assert result["status"] == "healthy", f"Health check failed: {result}"
    assert "timestamp" in result
    assert "database" in result
    assert "version" in result
    
    return result

def test_filter_options():
    """Test récupération options de filtrage"""
    from sobelec_extension.api_consolidated import get_filter_options
    result = get_filter_options()
    
    assert result["success"] == True, f"Filter options failed: {result}"
    assert "data" in result
    assert "item_groups" in result["data"]
    assert "warehouses" in result["data"]
    assert "brands" in result["data"]
    assert "price_lists" in result["data"]
    
    print(f"   - Groupes d'articles: {len(result['data']['item_groups'])}")
    print(f"   - Entrepôts: {len(result['data']['warehouses'])}")
    print(f"   - Marques: {len(result['data']['brands'])}")
    print(f"   - Listes de prix: {len(result['data']['price_lists'])}")
    
    return result

def test_search_items_basic():
    """Test recherche basique d'articles"""
    from sobelec_extension.api_consolidated import search_items
    
    # Test sans filtres
    result = search_items(limit=10)
    
    assert result["success"] == True, f"Search items failed: {result}"
    assert "data" in result
    assert "items" in result["data"]
    assert "total_count" in result["data"]
    
    items = result["data"]["items"]
    total_count = result["data"]["total_count"]
    
    print(f"   - Articles trouvés: {len(items)}")
    print(f"   - Total articles: {total_count}")
    
    if items:
        item = items[0]
        required_fields = ["item_code", "item_name", "item_group", "stock_uom", "total_stock", "selling_rate"]
        for field in required_fields:
            assert field in item, f"Champ {field} manquant dans l'article"
    
    return result

def test_search_items_advanced():
    """Test recherche avancée avec filtres"""
    from sobelec_extension.api_consolidated import search_items
    
    # Test avec filtres
    result = search_items(
        search_text="",
        status="stock_only",
        limit=5,
        sort_by="item_name",
        sort_order="desc"
    )
    
    assert result["success"] == True, f"Advanced search failed: {result}"
    
    items = result["data"]["items"]
    print(f"   - Articles avec stock: {len(items)}")
    
    # Vérifier le tri
    if len(items) > 1:
        for i in range(len(items) - 1):
            assert items[i]["item_name"] >= items[i+1]["item_name"], "Tri décroissant incorrect"
    
    return result

def test_item_complete_details():
    """Test récupération détails complets d'un article"""
    from sobelec_extension.api_consolidated import get_item_complete_details
    
    # Récupérer un article pour le test
    items = frappe.get_all("Item", limit=1, fields=["name"])
    if not items:
        raise Exception("Aucun article trouvé pour le test")
    
    item_code = items[0].name
    result = get_item_complete_details(item_code)
    
    assert result["success"] == True, f"Item details failed: {result}"
    assert "basic_info" in result
    assert "stock_info" in result
    assert "pricing_info" in result
    assert "supplier_info" in result
    
    basic_info = result["basic_info"]
    assert basic_info["item_code"] == item_code
    
    print(f"   - Article testé: {item_code}")
    print(f"   - Nom: {basic_info.get('item_name', 'N/A')}")
    print(f"   - Stock total: {result['stock_info'].get('total_stock', 0)}")
    print(f"   - Prix vente: {result['pricing_info'].get('standard_selling_rate', 0)}")
    
    return result

def test_item_stock_details():
    """Test récupération détails stock"""
    from sobelec_extension.api_consolidated import get_item_stock_details
    
    # Récupérer un article avec stock
    items_with_stock = frappe.db.sql("""
        SELECT DISTINCT item_code 
        FROM `tabBin` 
        WHERE actual_qty > 0 
        LIMIT 1
    """, as_dict=True)
    
    if not items_with_stock:
        print("   - Aucun article avec stock trouvé, test avec article quelconque")
        items = frappe.get_all("Item", limit=1, fields=["name"])
        if not items:
            raise Exception("Aucun article trouvé")
        item_code = items[0].name
    else:
        item_code = items_with_stock[0].item_code
    
    result = get_item_stock_details(item_code)
    
    assert "total_stock" in result
    assert "warehouse_count" in result
    
    print(f"   - Article testé: {item_code}")
    print(f"   - Stock total: {result['total_stock']}")
    print(f"   - Nombre d'entrepôts: {result['warehouse_count']}")
    
    return result

def test_legacy_apis():
    """Test des APIs legacy pour compatibilité"""
    from sobelec_extension.api_consolidated import get_item_stock_and_price, get_last_purchase_rate, get_main_supplier
    
    # Récupérer un article
    items = frappe.get_all("Item", limit=1, fields=["name"])
    if not items:
        raise Exception("Aucun article trouvé")
    
    item_code = items[0].name
    
    # Test get_item_stock_and_price
    result1 = get_item_stock_and_price(item_code)
    assert "item_code" in result1
    assert "stock_total" in result1
    assert "selling_price" in result1
    
    # Test get_last_purchase_rate
    result2 = get_last_purchase_rate(item_code)
    assert isinstance(result2, (int, float))
    
    # Test get_main_supplier
    result3 = get_main_supplier(item_code)
    assert isinstance(result3, str)
    
    print(f"   - Article testé: {item_code}")
    print(f"   - Stock: {result1['stock_total']}")
    print(f"   - Prix vente: {result1['selling_price']}")
    print(f"   - Dernier prix achat: {result2}")
    print(f"   - Fournisseur principal: {result3 or 'Aucun'}")
    
    return {
        "stock_and_price": result1,
        "last_purchase_rate": result2,
        "main_supplier": result3
    }

def test_performance():
    """Test de performance"""
    import time
    from sobelec_extension.api_consolidated import search_items
    
    # Test avec beaucoup d'articles
    start_time = time.time()
    result = search_items(limit=100)
    end_time = time.time()
    
    execution_time = end_time - start_time
    
    assert result["success"] == True
    assert execution_time < 5.0, f"Requête trop lente: {execution_time:.2f}s"
    
    print(f"   - Temps d'exécution: {execution_time:.3f}s")
    print(f"   - Articles récupérés: {len(result['data']['items'])}")
    print(f"   - Performance: {'✅ Rapide' if execution_time < 1.0 else '⚠️ Acceptable' if execution_time < 3.0 else '❌ Lent'}")
    
    return {
        "execution_time": execution_time,
        "items_count": len(result['data']['items'])
    }

def test_error_handling():
    """Test gestion d'erreurs"""
    from sobelec_extension.api_consolidated import get_item_complete_details, search_items
    
    test_cases = []
    
    # Test avec article inexistant
    try:
        get_item_complete_details("ARTICLE_INEXISTANT_12345")
        test_cases.append(("Article inexistant", "❌ Erreur non détectée"))
    except Exception as e:
        test_cases.append(("Article inexistant", f"✅ Erreur détectée: {str(e)[:50]}..."))
    
    # Test avec paramètres invalides
    try:
        result = search_items(limit=-1)
        # Devrait être corrigé automatiquement
        test_cases.append(("Limit négative", f"✅ Corrigé automatiquement: {len(result['data']['items'])} articles"))
    except Exception as e:
        test_cases.append(("Limit négative", f"✅ Erreur détectée: {str(e)[:50]}..."))
    
    # Test avec limit trop élevée
    try:
        result = search_items(limit=999999)
        # Devrait être limité automatiquement
        assert len(result['data']['items']) <= 1000, "Limite non respectée"
        test_cases.append(("Limit excessive", "✅ Limité automatiquement"))
    except Exception as e:
        test_cases.append(("Limit excessive", f"✅ Erreur détectée: {str(e)[:50]}..."))
    
    for test_name, result in test_cases:
        print(f"   - {test_name}: {result}")
    
    return test_cases

if __name__ == "__main__":
    try:
        results = test_all_apis()
        
        # Sauvegarder les résultats
        with open("/tmp/sobelec_test_results.json", "w") as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n📄 Résultats sauvegardés: /tmp/sobelec_test_results.json")
        
    except Exception as e:
        print(f"\n💥 ERREUR GLOBALE: {str(e)}")
        traceback.print_exc()
    
    finally:
        if frappe.db:
            frappe.db.close()
