import React, { useEffect, useRef } from 'react';
import './InputOTP.css';

const InputOTP = ({ length = 6, value, onChange, disabled = false, autoFocus = false }) => {
  const inputsRef = useRef([]);

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index, digit) => {
    const sanitized = digit.replace(/\D/g, '').slice(-1);
    const newValue = (value || '').split('');
    newValue[index] = sanitized;
    const updatedValue = newValue.join('').slice(0, length);
    onChange(updatedValue);

    if (sanitized && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !value?.[index] && inputsRef.current[index - 1]) {
      inputsRef.current[index - 1].focus();
    }
  };

  return (
    <div className="otp-container">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          maxLength={1}
          className="otp-input"
          value={value?.[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          ref={(el) => (inputsRef.current[index] = el)}
          disabled={disabled}
        />
      ))}
    </div>
  );
};

export default InputOTP;