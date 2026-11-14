"""PROPOSED ONLY: requires explicit approval before copying to CIRCUITPY."""
import usb_cdc

# Retain the existing console and CIRCUITPY drive; add a separate data channel.
usb_cdc.enable(console=True, data=True)
