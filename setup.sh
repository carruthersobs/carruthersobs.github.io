#!/usr/bin/env bash
# https://www1.grc.nasa.gov/
# https://www.nasa.gov/centers-and-facilities/glenn/space-environments-complex/
# https://api.nasa.gov/
# https://data.nasa.gov/

function help {
    echo "hello!"
}

function clean {
    rm assets -rf
}

function assets {
    mkdir -p assets
    cd assets

    # USWDS framework
    wget https://github.com/uswds/uswds/releases/download/v3.12.0/uswds-uswds-3.12.0.tgz
    tar xvf uswds-uswds-*.tgz
    rm uswds-uswds-*.tgz
    mv package uswds

    # NASAWDS framework
    wget https://github.com/bruffridge/nasawds/releases/download/v4.0.69/nasawds-4.0.69.zip
    unzip nasawds-*.zip
    rm nasawds-*.zip
    mv nasawds-*/* .
    rm nasawds-* -rf
}

"$@"