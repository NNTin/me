# tools/cookiecutter/gen_github_summary/__main__.py

from pathlib import Path
from cookiecutter.main import cookiecutter


def main():
    # This path is relative to the 'tools/' working directory
    template_path = Path("cookiecutter/cookiecutter-github-summary").resolve()

    configs = [
        {
            "github_username": "nntin",
            "repo_slug": "discord-twitter-bot",
        },
        {
            "github_username": "nntin",
            "repo_slug": "discord-logo",
        },
    ]

    for ctx in configs:
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
