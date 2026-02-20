import { ApiResponse } from "../types";

export const success = <T>(message: string, data: T): ApiResponse<T> => ({
  success: true,
  message: message,
  data,
});

export const failure = (
  message: string,
  error: string,
  errorCode?: string,
): ApiResponse => ({
  success: false,
  message,
  error,
  ...(errorCode && { errorCode }),
});
