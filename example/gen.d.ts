import { Elysia } from 'elysia';
export declare const app: Elysia<"", {
    decorator: {};
    store: {};
    derive: {};
    resolve: {};
}, {
    typebox: {};
    error: {};
}, {
    schema: {};
    standaloneSchema: {};
    macro: {};
    macroFn: {};
    parser: {};
}, {
    get: {
        body: unknown;
        params: {};
        query: unknown;
        headers: unknown;
        response: {
            200: {
                test: "hello";
            } | undefined;
            readonly 204: unknown;
            422: {
                type: "validation";
                on: string;
                summary?: string;
                message?: string;
                found?: unknown;
                property?: string;
                expected?: string;
            };
        };
    };
} & {
    json: {
        post: {
            body: {
                hello: string;
            };
            params: {};
            query: unknown;
            headers: unknown;
            response: {
                200: {
                    hello: string;
                };
                418: "I'm a teapot";
                422: {
                    type: "validation";
                    on: string;
                    summary?: string;                                                                                                                                        message?: string;
                    found?: unknown;
                    property?: string;
                    expected?: string;
                };
            };
        };
    };
} & {
    id: {
        ":id": {
            name: {
                ":name": {
                    get: {
                        body: unknown;
                        params: {
                            name: string;
                            id: string;
                        };
                        query: unknown;
                        headers: unknown;
                        response: {
                            200: {
                                name: string;
                                id: string;
                            };
                            422: {
                                type: "validation";
                                on: string;
                                summary?: string;
                                message?: string;
                                found?: unknown;
                                property?: string;
                                expected?: string;
                            };
                        };
                    };
                };
            };
        };
    };
}, {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
}, {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
}>;
