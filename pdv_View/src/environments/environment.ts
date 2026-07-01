declare var process: any;

export const environment = {
  production: true,
  apiUrl: process.env['API_URL'] as string,
};
