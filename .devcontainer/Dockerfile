# Use Ubuntu 22.04 base image
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    software-properties-common \
    curl \
    wget \
    build-essential \
    libffi-dev \
    libjpeg-dev \
    libxml2 \
    libpango-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libssl-dev \
    libxslt1.1 \
    libcairo2 \
    git \
    sudo \
    zlib1g-dev \
    libyaml-dev \
    libreadline-dev \
    libncurses5-dev \
    libtool \
    libgmp-dev \
    libsqlite3-dev \
    ruby-full \
    rake \
    nodejs \
    npm \
    coreutils \
    apt-transport-https \
    gnupg2 \
    && rm -rf /var/lib/apt/lists/*

# Install PowerShell
RUN wget -q "https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb" -O packages-microsoft-prod.deb && \
    dpkg -i packages-microsoft-prod.deb && \
    rm packages-microsoft-prod.deb && \
    apt-get update && \
    apt-get install -y powershell && \
    rm -rf /var/lib/apt/lists/*

# Install Python 3.13
RUN curl -O https://www.python.org/ftp/python/3.13.0/Python-3.13.0.tgz && \
    tar xzf Python-3.13.0.tgz && \
    cd Python-3.13.0 && \
    ./configure --enable-optimizations && \
    make -j$(nproc) && \
    make altinstall && \
    cd .. && \
    rm -rf Python-3.13.0 Python-3.13.0.tgz

RUN ln -s /usr/local/bin/python3.13 /usr/local/bin/python && \
    ln -s /usr/local/bin/pip3.13 /usr/local/bin/pip

# Create user
ARG USERNAME=devuser
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME && \
    useradd --uid $USER_UID --gid $USER_GID -m $USERNAME && \
    usermod -aG sudo $USERNAME && \
    echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER $USERNAME
WORKDIR /home/$USERNAME

# Set up Ruby environment for user installation
ENV GEM_HOME="/home/$USERNAME/.gems"
ENV PATH="/home/$USERNAME/.gems/bin:$PATH"

# Create gems directory and install Bundler
RUN mkdir -p $GEM_HOME && \
    gem install bundler

# Set the working directory for Jekyll projects
WORKDIR /workspace

# Keep container running
CMD ["sleep", "infinity"]
