# tools/cookiecutter/gen_github_summary/__main__.py

from pathlib import Path
from cookiecutter.main import cookiecutter


def main():
    # This path is relative to the 'tools/' working directory
    template_path = Path("cookiecutter/cookiecutter-github-summary").resolve()

    configs = [
        # List of repositories to generate summaries for
        #  initial landing
        {"repo_slug": "me"},
        {"repo_slug": "nntin.github.io"},
        {"repo_slug": "NNTin"},
        #  bigger projects
        {"repo_slug": "discord-logo"},
        {"repo_slug": "discord-web-bridge"},
        {"repo_slug": "discord-twitter-bot"},
        {"repo_slug": "Reply-Dota-2-Reddit"},
        #  heroku adventures
        {"repo_slug": "crosku"},
        {"repo_slug": "Red-kun"},
        {"repo_slug": "shell-kun"},
        #  reddit adventures
        {"repo_slug": "tracker-reddit-discord"},
        {"repo_slug": "dev-tracker-reddit"},
        {"repo_slug": "Reply-LoL-Reddit"},
        {"repo_slug": "Cubify-Reddit"},
        {"repo_slug": "Dota-2-Emoticons"},
        {"repo_slug": "Dota-2-Reddit-Flair-Mosaic"},
        #  REST API adventures
        {"repo_slug": "pasteview"},
        {"repo_slug": "pasteindex"},
        {"repo_slug": "twitter-backend"},
    ]

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
