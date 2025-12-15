/**
 * Example TypeScript Definition File
 * Place .d.ts files in your project to get IntelliSense for custom code
 */

// Example 1: Custom API Module
declare module 'my-api' {
  export interface User {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
  }

  export interface Post {
    id: number;
    title: string;
    content: string;
    authorId: number;
    author?: User;
  }

  export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: number;
  }

  export class APIClient {
    constructor(baseURL: string, apiKey?: string);

    getUser(id: number): Promise<APIResponse<User>>;
    createUser(data: Omit<User, 'id' | 'createdAt'>): Promise<APIResponse<User>>;
    updateUser(id: number, data: Partial<User>): Promise<APIResponse<User>>;
    deleteUser(id: number): Promise<APIResponse<void>>;

    getPosts(userId?: number): Promise<APIResponse<Post[]>>;
    getPost(id: number): Promise<APIResponse<Post>>;
    createPost(data: Omit<Post, 'id'>): Promise<APIResponse<Post>>;
  }

  export default APIClient;
}

// Example 2: Global Namespace
declare namespace App {
  interface Config {
    apiURL: string;
    timeout: number;
    retryAttempts: number;
  }

  interface State {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
  }

  interface User {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'user' | 'guest';
  }
}

// Example 3: Global Functions
declare function log(message: string, level?: 'info' | 'warn' | 'error'): void;
declare function fetchData<T>(endpoint: string): Promise<T>;
declare function formatDate(date: Date, format: string): string;

// Example 4: Augmenting Existing Types
interface Window {
  myApp: {
    version: string;
    config: App.Config;
    state: App.State;
  };
}

// Example 5: Custom Utility Types
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;

type Nullable<T> = T | null | undefined;

// Example 6: Enum-like Constants
declare const enum StatusCode {
  OK = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  NotFound = 404,
  ServerError = 500
}

// Example 7: Event Types
interface CustomEventMap {
  'user:login': CustomEvent<{ user: App.User }>;
  'user:logout': CustomEvent<void>;
  'data:updated': CustomEvent<{ data: any; timestamp: number }>;
}

declare global {
  interface WindowEventMap extends CustomEventMap {}
}

// Example 8: React Component Props (if using React)
declare namespace JSX {
  interface IntrinsicElements {
    'my-custom-element': {
      value?: string;
      onChange?: (value: string) => void;
      disabled?: boolean;
    };
  }
}

// Example 9: Class with Static Members
declare class Database {
  static instance: Database;
  static getInstance(): Database;

  connect(connectionString: string): Promise<void>;
  disconnect(): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
}

// Example 10: Module with Default and Named Exports
declare module 'my-utils' {
  export function capitalize(str: string): string;
  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): T;
  export function deepClone<T>(obj: T): T;

  const utils: {
    capitalize: typeof capitalize;
    debounce: typeof debounce;
    deepClone: typeof deepClone;
  };

  export default utils;
}
