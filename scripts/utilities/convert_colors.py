# Leer el archivo
with open("src/frontend/home.html", "r", encoding="utf-8") as f:
    content = f.read()

# Mapeo de colores viejos a nuevos (Violeta Premium)
replacements = {
    "rgba(79, 70, 229, 0.05)": "rgba(124, 58, 237, 0.05)",
    "rgba(79, 70, 229, 0.08)": "rgba(124, 58, 237, 0.08)",
    "rgba(79, 70, 229, 0.1)": "rgba(124, 58, 237, 0.1)",
    "rgba(79, 70, 229, 0.12)": "rgba(124, 58, 237, 0.12)",
    "rgba(79, 70, 229, 0.15)": "rgba(124, 58, 237, 0.15)",
    "rgba(79, 70, 229, 0.18)": "rgba(124, 58, 237, 0.18)",
    "rgba(79, 70, 229, 0.25)": "rgba(124, 58, 237, 0.25)",
    "rgba(79, 70, 229, 0.3)": "rgba(124, 58, 237, 0.3)",
    "rgba(79, 70, 229, 0.35)": "rgba(124, 58, 237, 0.35)",
    "rgba(79, 70, 229, 0.45)": "rgba(124, 58, 237, 0.45)",
}

# Reemplazar todos los colores
total_replaced = 0
for old, new in replacements.items():
    times = content.count(old)
    if times > 0:
        content = content.replace(old, new)
        total_replaced += times
        print(f"   {old} → {new}: {times}x")

# Escribir de vuelta
with open("src/frontend/home.html", "w", encoding="utf-8") as f:
    f.write(content)

print("\n✅ VIOLETA PREMIUM APLICADA")
print(f"   Total de reemplazos: {total_replaced}")
print("   Archivo: src/frontend/home.html")
