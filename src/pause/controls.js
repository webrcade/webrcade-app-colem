import React from 'react';

import { ControlsTab } from '@webrcade/app-common';

// pass in controller type...
const getDefaultName = (emulator, value) => {
  const controlsMode = emulator.controlsMode;
  const isSuper = controlsMode === emulator.CONTROLS_SUPER_ACTION;
  const isDriving = controlsMode === emulator.CONTROLS_DRIVING;

  if (value === "1") {
    return "Keypad 1";
  } else if (value === "2") {
    return "Keypad 2";
  } else if (value === "3") {
    return "Keypad 3";
  } else if (value === "4") {
    return "Keypad 4";
  } else if (value === "5") {
    return "Keypad 5";
  } else if (value === "6") {
    return "Keypad 6";
  } else if (value === "7") {
    return "Keypad 7";
  } else if (value === "8") {
    return "Keypad 8";
  } else if (value === "9") {
    return "Keypad 9";
  } else if (value === "0") {
    return "Keypad 0";
  } else if (value === "*") {
    return "Keypad *";
  } else if (value === "#") {
    return "Keypad #";
  } else if (value === "firel") {
    let firelLabel = "Left Fire";
    if (isDriving) {
      firelLabel = "Gas Button";
    } else if (isSuper) {
      firelLabel = "Yellow Button";
    }
    return firelLabel;
  } else if (value === "firer") {
    let firerLabel = "Right Fire";
    if (isDriving) {
      firerLabel = "Brake Button";
    } else if (isSuper) {
      firerLabel = "Orange Button";
    }
    return firerLabel;
  } else if (value === "firel2") {
    return "Left Fire (2p)";
  } else if (value === "firer2") {
    return "Right Fire (2p)";
  } else if (value === "purple") {
    return "Purple Button";
  } else if (value === "blue") {
    return "Blue Button";
  }
}

const getName = (emulator, button, mappings, descriptions) => {
  const value = mappings[button];
  if (!value) return null;

  const description = descriptions[value];
  return description ? description : getDefaultName(emulator, value);
}

const getNameForValue = (emulator, value, descriptions) => {
  const description = descriptions[value];
  return description ? description : getDefaultName(emulator, value);
}

export class GamepadControlsTab extends ControlsTab {
  render() {
    const { emulator } = this.props;
    const mappings = emulator.mappings;
    let descriptions = emulator.getApp().descriptions;
    if (!descriptions) descriptions = {}

    const controlsMode = emulator.controlsMode;
    const isRoller = controlsMode === emulator.CONTROLS_ROLLER;
    const isSuper = controlsMode === emulator.CONTROLS_SUPER_ACTION;
    const isDriving = controlsMode === emulator.CONTROLS_DRIVING;

    const aName = getName(emulator, "a", mappings, descriptions);
    const bName = getName(emulator, "b", mappings, descriptions);
    const xName = getName(emulator, "x", mappings, descriptions);
    const yName = getName(emulator, "y", mappings, descriptions);
    const lbName = getName(emulator, "lb", mappings, descriptions);
    const rbName = getName(emulator, "rb", mappings, descriptions);
    const ltName = getName(emulator, "lt", mappings, descriptions);
    const rtName = getName(emulator, "rt", mappings, descriptions);

    return (
      <>
        {this.renderControl('start', 'Toggle Keypad Display')}
        {isRoller && this.renderControl('lanalog', 'Roller')}
        {isDriving && this.renderControl('lanalog', 'Steer')}
        {!isDriving && !isRoller && this.renderControl('lanalog', 'Joystick')}
        {this.renderControl('dpad', 'Joystick')}
        {isSuper && this.renderControl('ranalog', 'Spinner')}
        {aName && this.renderControl('a', aName)}
        {bName && this.renderControl('b', bName)}
        {xName && this.renderControl('x', xName)}
        {yName && this.renderControl('y', yName)}
        {lbName && this.renderControl('lbump', lbName)}
        {rbName && this.renderControl('rbump', rbName)}
        {ltName && this.renderControl('ltrig', ltName)}
        {rtName && this.renderControl('rtrig', rtName)}
      </>
    );
  }
}

export class KeyboardControlsTab extends ControlsTab {
  render() {
    const { emulator } = this.props;
    const mappings = emulator.mappings;
    let descriptions = emulator.getApp().descriptions;
    if (!descriptions) descriptions = {}

    const aName = getName(emulator, "a", mappings, descriptions);
    const bName = getName(emulator, "b", mappings, descriptions);
    const xName = getName(emulator, "x", mappings, descriptions);
    const yName = getName(emulator, "y", mappings, descriptions);
    const lbName = getName(emulator, "lb", mappings, descriptions);
    const rbName = getName(emulator, "rb", mappings, descriptions);
    const ltName = getName(emulator, "lt", mappings, descriptions);
    const rtName = getName(emulator, "rt", mappings, descriptions);

    return (
      <>
        {this.renderKey('Enter', 'Toggle Keypad Display')}
        {this.renderKey('ArrowUp', 'Joystick Up')}
        {this.renderKey('ArrowDown', 'Joystick Down')}
        {this.renderKey('ArrowLeft', 'Joystick Left')}
        {this.renderKey('ArrowRight', 'Joystick Right')}
        {aName && this.renderKey('KeyZ', aName)}
        {bName && this.renderKey('KeyX', bName)}
        {xName && this.renderKey('KeyA', xName)}
        {yName && this.renderKey('KeyS', yName)}
        {lbName && this.renderKey('KeyW', lbName)}
        {rbName && this.renderKey('KeyE', rbName)}
        {ltName && this.renderKey('KeyQ', ltName)}
        {rtName && this.renderKey('KeyR', rtName)}
        {this.renderKey('Digit1', getNameForValue(emulator, '1', descriptions))}
        {this.renderKey('Digit2', getNameForValue(emulator, '2', descriptions))}
        {this.renderKey('Digit3', getNameForValue(emulator, '3', descriptions))}
        {this.renderKey('Digit4', getNameForValue(emulator, '4', descriptions))}
        {this.renderKey('Digit5', getNameForValue(emulator, '5', descriptions))}
        {this.renderKey('Digit6', getNameForValue(emulator, '6', descriptions))}
        {this.renderKey('Digit7', getNameForValue(emulator, '7', descriptions))}
        {this.renderKey('Digit8', getNameForValue(emulator, '8', descriptions))}
        {this.renderKey('Digit9', getNameForValue(emulator, '9', descriptions))}
        {this.renderKey('Minus', getNameForValue(emulator, '*', descriptions))}
        {this.renderKey('Digit0', getNameForValue(emulator, '0', descriptions))}
        {this.renderKey('Equal', getNameForValue(emulator, '#', descriptions))}
      </>
    );
  }
}
