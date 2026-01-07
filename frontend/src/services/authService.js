import API from './api';

export const requestPasswordReset = async (email) => {
  const { data } = await API.post('/auth/forgot-password', { email });
  return data;
};

export const resetPassword = async ({ email, code, newPassword, confirmPassword }) => {
  const { data } = await API.post('/auth/reset-password', {
    email,
    code,
    newPassword,
    confirmPassword,
  });
  return data;
};