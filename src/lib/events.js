export const triggerFocusUpload = () => {
  const event = new CustomEvent('focus-upload');
  window.dispatchEvent(event);
}; 