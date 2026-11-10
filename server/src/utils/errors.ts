export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const BadRequest = (m: string) => new HttpError(400, m);
export const Unauthorized = (m = "Unauthorized") => new HttpError(401, m);
export const Forbidden = (m = "Forbidden") => new HttpError(403, m);
export const NotFound = (m = "Not found") => new HttpError(404, m);