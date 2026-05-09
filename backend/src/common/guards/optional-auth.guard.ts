import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Allows requests with or without JWT.
 * If JWT is present and valid, `req.user` is populated.
 * If missing/invalid, request still proceeds with `req.user` as undefined.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest(err: any, user: any) {
    if (err) return undefined;
    return user;
  }
}

