# tools/cookiecutter/gen_github_summary/__main__.py

import json
from pathlib import Path
from cookiecutter.main import cookiecutter


def load_repo_configs():
    """Load repository configurations from JSON file and convert to cookiecutter format."""
    config_path = Path("data/repos.json")
    with open(config_path, "r") as f:
        repos = json.load(f)

    # Convert to cookiecutter format (only repo name, omit owner)
    return [{"repo_slug": repo["repo"]} for repo in repos]


def main():
    # This path is relative to the 'tools/' working directory
    template_path = Path("cookiecutter/cookiecutter-github-summary").resolve()

    configs = load_repo_configs()

    for ctx in configs:
        ctx["github_username"] = "nntin"
        cookiecutter(
            str(template_path),
            no_input=True,
            extra_context=ctx,
            output_dir="../_drafts",
        )


if __name__ == "__main__":
    main()

# assuming working directory is tools/ execute script with
# python -m gen_github_summary
