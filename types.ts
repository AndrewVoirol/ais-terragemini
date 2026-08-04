export interface Coordinates {
    lat: number;
    lon: number;
}

export interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
    isError?: boolean;
}

export enum ChatState {
    IDLE,
    LOADING,
    ERROR
}