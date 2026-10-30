path = r'backend/app/workflow.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

old = '"allowed_roles": ["officer", "evc_expert", "admin"],'
new = '"allowed_roles": ["officer", "admin"],'

assert old in text, f"could not find {old}"
text = text.replace(old, new, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated workflow.py allowed_roles successfully!")
