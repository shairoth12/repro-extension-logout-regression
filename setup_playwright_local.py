import subprocess

VENV_DIR = ".venv"

# This is coupled with version of python in .devcontainer/Dockerfile (which is determined by the
# ubuntu version of the base image, e.g. `playwright/python:v1.x.x-jammy` uses 3.10).
# So, if you update the ubuntu version in the Dockerfile, update the corresponding python version here.
PYTHON_EXECUTABLE = "/opt/homebrew/bin/python3.10"


def create_virtual_environment():
    print("Creating virtual environment")
    subprocess.run([PYTHON_EXECUTABLE, "-m", "venv", VENV_DIR], check=True)


def install_python_dependencies():
    print("Installing python dependencies:")
    subprocess.run(
        [f"{VENV_DIR}/bin/pip", "install", "-r", "./requirements.txt"],
        check=True,
    )


def install_playwright():
    print("\nInstalling playwright")
    subprocess.run([f"{VENV_DIR}/bin/playwright", "install"], check=True)


if __name__ == "__main__":
    create_virtual_environment()
    install_python_dependencies()
    install_playwright()
