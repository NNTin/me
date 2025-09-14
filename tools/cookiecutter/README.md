# Cookiecutter Template Example

This guide shows how to:

1. Install Cookiecutter
2. Create a basic template
3. Use the template to generate a project

---

## 1. Install Cookiecutter

```bash
pip install cookiecutter
```

## 2. Create a Template

Create a folder for your template:

```sql
cookiecutter-simple/
├── cookiecutter.json
└── {{cookiecutter.project_slug}}/
    └── README.md
```

cookiecutter.json

```json
{
  "project_name": "My Project",
  "project_slug": "{{ cookiecutter.project_name.lower().replace(' ', '_') }}"
}
```

## 3. Use the Template

In your terminal:

```bash
cookiecutter path/to/cookiecutter-simple
```

You’ll be asked:

```bash
project_name [My Project]:
```

Enter a name like `Test Project`, and it will generate:

```sql
test_project/
└── README.md  → contains "# Test Project"
```

## ✅ Result

Generated README.md content:

```md
# Test Project
```
