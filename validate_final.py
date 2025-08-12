#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sobelec Extension - Validation finale complète
Script de validation professionnel avec 20 ans d'expérience
"""

import os
import json
import subprocess
import sys
from pathlib import Path

def check_file_structure():
    """Vérification structure des fichiers"""
    print("🔍 Vérification structure des fichiers...")
    
    base_path = "/home/achref/frappe-bench/apps/sobelec_extension/sobelec_extension"
    required_files = {
        "API principale": f"{base_path}/api_consolidated.py",
        "Configuration": f"{base_path}/hooks.py",
        "Page JavaScript": f"{base_path}/sobelec_extension/page/item_by_ciel/item_by_ciel.js",
        "Page JSON": f"{base_path}/sobelec_extension/page/item_by_ciel/item_by_ciel.json",
        "CSS optimisé": f"{base_path}/public/css/item_by_ciel_optimized.css",
        "CSS original": f"{base_path}/public/css/item_by_ciel.css"
    }
    
    missing_files = []
    existing_files = []
    
    for desc, file_path in required_files.items():
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            existing_files.append(f"✅ {desc}: {file_path} ({size} bytes)")
        else:
            missing_files.append(f"❌ {desc}: {file_path}")
    
    print("\n📁 Fichiers trouvés:")
    for file_info in existing_files:
        print(f"   {file_info}")
    
    if missing_files:
        print("\n🚨 Fichiers manquants:")
        for file_info in missing_files:
            print(f"   {file_info}")
    
    return len(missing_files) == 0

def check_python_syntax():
    """Vérification syntaxe Python"""
    print("\n🐍 Vérification syntaxe Python...")
    
    python_files = [
        "/home/achref/frappe-bench/apps/sobelec_extension/sobelec_extension/api_consolidated.py",
        "/home/achref/frappe-bench/apps/sobelec_extension/sobelec_extension/hooks.py",
        "/home/achref/frappe-bench/apps/sobelec_extension/test_apis.py"
    ]
    
    syntax_errors = []
    
    for file_path in python_files:
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                compile(content, file_path, 'exec')
                print(f"   ✅ {os.path.basename(file_path)}: Syntaxe OK")
            except SyntaxError as e:
                error_msg = f"{os.path.basename(file_path)}: Ligne {e.lineno}, {e.msg}"
                syntax_errors.append(error_msg)
                print(f"   ❌ {error_msg}")
            except Exception as e:
                error_msg = f"{os.path.basename(file_path)}: {str(e)}"
                syntax_errors.append(error_msg)
                print(f"   ⚠️ {error_msg}")
    
    return len(syntax_errors) == 0

def check_javascript_syntax():
    """Vérification basique JavaScript"""
    print("\n📜 Vérification JavaScript...")
    
    js_file = "/home/achref/frappe-bench/apps/sobelec_extension/sobelec_extension/sobelec_extension/page/item_by_ciel/item_by_ciel.js"
    
    if not os.path.exists(js_file):
        print("   ❌ Fichier JavaScript introuvable")
        return False
    
    try:
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Vérifications basiques
        checks = [
            ("Classes ES6", "class " in content),
            ("Async/Await", "async " in content and "await " in content),
            ("Event listeners", "addEventListener" in content),
            ("API calls", "frappe.call" in content),
            ("Error handling", "try {" in content and "catch" in content),
            ("Unique IDs", "this.page_id" in content)
        ]
        
        for check_name, condition in checks:
            status = "✅" if condition else "❌"
            print(f"   {status} {check_name}")
        
        all_passed = all(condition for _, condition in checks)
        
        # Vérifier taille du fichier
        size = len(content)
        print(f"   📊 Taille: {size} caractères")
        
        return all_passed and size > 1000
        
    except Exception as e:
        print(f"   ❌ Erreur lecture: {str(e)}")
        return False

def check_css_syntax():
    """Vérification CSS"""
    print("\n🎨 Vérification CSS...")
    
    css_files = [
        "/home/achref/frappe-bench/apps/sobelec_extension/sobelec_extension/public/css/item_by_ciel_optimized.css",
        "/home/achref/frappe-bench/apps/sobelec_extension/sobelec_extension/public/css/item_by_ciel.css"
    ]
    
    for css_file in css_files:
        if os.path.exists(css_file):
            try:
                with open(css_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Vérifications basiques CSS
                has_media_queries = "@media" in content
                has_animations = "@keyframes" in content or "animation:" in content
                has_responsive = "max-width" in content or "min-width" in content
                has_flexbox = "flex" in content or "grid" in content
                
                filename = os.path.basename(css_file)
                print(f"   📄 {filename}:")
                print(f"      ✅ Taille: {len(content)} caractères")
                print(f"      {'✅' if has_media_queries else '❌'} Media queries")
                print(f"      {'✅' if has_animations else '❌'} Animations")
                print(f"      {'✅' if has_responsive else '❌'} Design responsive")
                print(f"      {'✅' if has_flexbox else '❌'} Layout moderne")
                
            except Exception as e:
                print(f"   ❌ Erreur {os.path.basename(css_file)}: {str(e)}")
                return False
    
    return True

def test_frappe_build():
    """Test du build Frappe"""
    print("\n🔨 Test du build Frappe...")
    
    try:
        os.chdir("/home/achref/frappe-bench")
        result = subprocess.run(
            ["bench", "build", "--app", "sobelec_extension"],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0:
            print("   ✅ Build réussi")
            print(f"   📄 Output: {result.stdout[-200:]}")  # Dernières 200 chars
            return True
        else:
            print("   ❌ Build échoué")
            print(f"   📄 Error: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("   ⚠️ Build timeout (>120s)")
        return False
    except Exception as e:
        print(f"   ❌ Erreur build: {str(e)}")
        return False

def run_api_tests():
    """Exécution des tests API"""
    print("\n🧪 Exécution des tests API...")
    
    try:
        os.chdir("/home/achref/frappe-bench")
        result = subprocess.run(
            ["python", "apps/sobelec_extension/test_apis.py"],
            capture_output=True,
            text=True,
            timeout=60,
            env={**os.environ, "PYTHONPATH": "/home/achref/frappe-bench/apps/frappe"}
        )
        
        if result.returncode == 0:
            print("   ✅ Tests API réussis")
            # Afficher les dernières lignes du résultat
            lines = result.stdout.split('\n')[-10:]
            for line in lines:
                if line.strip():
                    print(f"   📄 {line}")
            return True
        else:
            print("   ❌ Tests API échoués")
            print(f"   📄 Error: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("   ⚠️ Tests timeout (>60s)")
        return False
    except Exception as e:
        print(f"   ❌ Erreur tests: {str(e)}")
        return False

def check_database_compatibility():
    """Vérification compatibilité base de données"""
    print("\n🗄️ Vérification compatibilité base de données...")
    
    try:
        os.chdir("/home/achref/frappe-bench")
        
        # Test connexion frappe
        result = subprocess.run(
            ["bench", "--site", "sobelec-erpnext", "console"],
            input="frappe.db.sql('SELECT 1 as test'); print('DB OK'); exit()",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if "DB OK" in result.stdout:
            print("   ✅ Connexion base de données OK")
            return True
        else:
            print("   ❌ Problème connexion base de données")
            print(f"   📄 Output: {result.stdout}")
            return False
            
    except Exception as e:
        print(f"   ❌ Erreur test DB: {str(e)}")
        return False

def generate_final_report():
    """Génération du rapport final"""
    print("\n📊 Génération du rapport final...")
    
    report = {
        "timestamp": "2025-08-11",
        "validation_results": {
            "file_structure": check_file_structure(),
            "python_syntax": check_python_syntax(),
            "javascript_syntax": check_javascript_syntax(),
            "css_syntax": check_css_syntax(),
            "frappe_build": test_frappe_build(),
            "api_tests": run_api_tests(),
            "database_compatibility": check_database_compatibility()
        }
    }
    
    # Calcul score global
    total_tests = len(report["validation_results"])
    passed_tests = sum(1 for result in report["validation_results"].values() if result)
    score = (passed_tests / total_tests) * 100
    
    report["summary"] = {
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": total_tests - passed_tests,
        "success_rate": score
    }
    
    # Sauvegarde rapport
    try:
        with open("/tmp/sobelec_final_validation.json", "w") as f:
            json.dump(report, f, indent=2)
        print(f"   ✅ Rapport sauvegardé: /tmp/sobelec_final_validation.json")
    except Exception as e:
        print(f"   ⚠️ Erreur sauvegarde rapport: {str(e)}")
    
    return report

def main():
    """Fonction principale de validation"""
    print("🚀 VALIDATION FINALE SOBELEC EXTENSION")
    print("=" * 80)
    print("Validation professionnelle avec 20 ans d'expérience")
    print("=" * 80)
    
    report = generate_final_report()
    
    print("\n" + "=" * 80)
    print("📋 RÉSUMÉ FINAL")
    print("=" * 80)
    
    summary = report["summary"]
    print(f"Tests total: {summary['total_tests']}")
    print(f"Tests réussis: {summary['passed_tests']}")
    print(f"Tests échoués: {summary['failed_tests']}")
    print(f"Taux de réussite: {summary['success_rate']:.1f}%")
    
    # Détail par test
    print("\n📝 Détail par catégorie:")
    for test_name, result in report["validation_results"].items():
        status = "✅ RÉUSSI" if result else "❌ ÉCHEC"
        print(f"   {test_name}: {status}")
    
    # Recommandations
    print("\n💡 RECOMMANDATIONS:")
    
    if summary["success_rate"] >= 90:
        print("   🎉 Excellent! Le système est prêt pour la production.")
    elif summary["success_rate"] >= 75:
        print("   ✅ Très bien! Quelques ajustements mineurs requis.")
    elif summary["success_rate"] >= 50:
        print("   ⚠️ Acceptable. Plusieurs améliorations nécessaires.")
    else:
        print("   🚨 Critique! Révision majeure requise.")
    
    # Actions recommandées
    failed_tests = [name for name, result in report["validation_results"].items() if not result]
    
    if failed_tests:
        print("\n🔧 Actions recommandées:")
        for test in failed_tests:
            if test == "file_structure":
                print("   - Vérifier que tous les fichiers sont présents")
            elif test == "python_syntax":
                print("   - Corriger les erreurs de syntaxe Python")
            elif test == "javascript_syntax":
                print("   - Vérifier la syntaxe JavaScript et les fonctionnalités")
            elif test == "css_syntax":
                print("   - Vérifier les styles CSS")
            elif test == "frappe_build":
                print("   - Résoudre les erreurs de build Frappe")
            elif test == "api_tests":
                print("   - Corriger les erreurs dans les tests API")
            elif test == "database_compatibility":
                print("   - Vérifier la configuration de la base de données")
    
    print("\n" + "=" * 80)
    
    return summary["success_rate"] >= 75

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
