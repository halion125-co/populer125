export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  phone?: string;
  vendorId?: string;
  accessKey?: string;
  secretKey?: string;
}

export interface UserProfile {
  id: number;
  email: string;
  phone: string;
  vendorId: string;
  accessKey: string;
  hasSecret: boolean;
  nameKo: string;
  nameEn: string;
  zipcode: string;
  addressKo: string;
  addressDetailKo: string;
  addressEn: string;
  addressDetailEn: string;
  customsType: string;
  customsNumber: string;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  user: UserProfile;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}
