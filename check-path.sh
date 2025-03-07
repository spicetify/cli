#!/bin/bash

# Author: wintervoid
# Function to find the path of Spotify
find_spotify_path() {
    # Check if Spotify is installed to /opt/spotify
    if [ -d "/opt/spotify" ]; then
        echo "/opt/spotify"
        return
    fi

    # Check if Spotify is installed via spotify-launcher 
    if [ -d "$HOME/.local/share/spotify-launcher/install/usr/share/spotify/" ]; then
        echo "$HOME/.local/share/spotify-launcher/install/usr/share/spotify/"
        return
    fi

    # Check for Spotify installed via Homebrew (LinuxBrew)
    if command -v brew &> /dev/null; then
        if [ -d "$(brew --prefix spotify)" ]; then
            echo "$(brew --prefix spotify)"
            return
        fi
    fi

    # Check if Spotify is installed via Flatpak
    if [ -d "$HOME/.local/share/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify/" ]; then
        echo "$HOME/.local/share/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify/"
        return
    fi

    # Check for Spotify Snap installation 
    if [ -d "/snap/spotify/current" ]; then
        echo "Spicetify does not support Snap. Please install from either Flatpak or your distro's package manager."
        return
    fi

    # Check if Spotify is installed via apt 
    if [ -d "/usr/share/spotify" ]; then
        echo "/usr/share/spotify"
        return
    fi

    # If no installation location was found
    echo "Spotify not found. Please ensure Spotify is installed."
    exit 1
}

# Function to update Spicetify's config file with the found path
update_spicetify_config() {
    local spotify_path=$1
    local config_file="$HOME/.config/spicetify/config-xpui.ini"

    # Check if Spicetify's config file exists
    if [ ! -f "$config_file" ]; then
        echo "Spicetify config file not found at $config_file. Please ensure Spicetify is installed."
        exit 1
    fi

    # Update the spotify_path in the config file
    echo "Updating Spicetify config with spotify_path: $spotify_path"
    
    # Use sed to update the spotify_path
    sed -i "s|^spotify_path.*|spotify_path = \"$spotify_path\"|" "$config_file"

    # If successful, print a confirmation message
    echo "Spicetify config updated successfully."
}

# Find the Spotify path
SPOTIFY_PATH=$(find_spotify_path)
echo "Spotify found at $SPOTIFY_PATH"

# Prompt user to update Spicetify config
read -p "Do you want to update Spicetify's config with this path? (y/n): " update_config

# If user chooses 'y' or 'Y', update the config
if [[ "$update_config" == "y" || "$update_config" == "Y" ]]; then
    update_spicetify_config "$SPOTIFY_PATH"
else
    echo "Spicetify config update skipped."
fi
