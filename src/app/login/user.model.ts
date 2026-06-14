export interface UserInterface {
  email: string;
  id: number;
  token: string;
  name: string;
  role: string;
}

export class User {
  email = '';
  id = 0;
  token = '';
  name = ''
  role = '';

  constructor(
    email: string,
    id: number,
    token: string,
    name: string,
    role: string,
  ) {
    return {
      email: email,
      id: id,
      token: token,
      name: name,
      role: role
    }
  }
}
