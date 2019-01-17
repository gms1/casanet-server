import * as chai from 'chai';
import { assert, expect } from 'chai';
import * as express from 'express';
import { AuthBl } from '../../src/business-layer/authBl';
import { SessionsBl } from '../../src/business-layer/sessionsBl';
import { UsersBl } from '../../src/business-layer/usersBl';
import { Configuration } from '../../src/config';
import { SessionsDal } from '../../src/data-layer/sessionsDal';
import { UsersDal } from '../../src/data-layer/usersDal';
import { Session } from '../../src/models/backendInterfaces';
import { ErrorResponse, User } from '../../src/models/sharedInterfaces';
import * as cryptoJs from 'crypto-js';

class SessionsDalMock {

    public mockSessions: Session[] = [
        {
            keyHash: '1234',
            timeStump: new Date().getTime(),
            email: 'aa@bb.com',
        },
        {
            keyHash: '12345',
            timeStump: 300,
            email: 'aa@bb.com',
        },
        {
            keyHash: '1234',
            timeStump: new Date().getTime(),
            email: 'aaa@bb.com',
        },
        {
            keyHash: '123456',
            timeStump: new Date().getTime() - 1000,
            email: 'aa@bb.com',
        },
    ];

    public async getSessions(): Promise<Session[]> {
        return this.mockSessions;
    }

    public async getSession(email: string): Promise<Session> {
        for (const session of this.mockSessions) {
            if (session.email === email) {
                return session;
            }
        }
        throw new Error('not exsit');
    }

    public async createSession(newSession: Session): Promise<void> {
        this.mockSessions.push(newSession);
    }

    public async deleteSession(session: Session): Promise<void> {
        this.mockSessions.splice(this.mockSessions.indexOf(session), 1);
    }
}

// tslint:disable-next-line:max-classes-per-file
class UsersDalMock {

    public mockUsers: User[] = [
        {
            email: 'aa@bb.com',
            displayName: 'firstName1',
            ignoreTfa: true,
            password: '1234',
            sessionTimeOutMS: 123454321,
            scope : 'userAuth',
        },
        {
            email: 'aa@bbb.com',
            displayName: 'firstName2',
            ignoreTfa: true,
            password: 'password',
            sessionTimeOutMS: 765432,
            scope : 'userAuth',
        },
        {
            email: 'aaa@bb.com',
            displayName: 'firstName3',
            ignoreTfa: false,
            password: 'password',
            sessionTimeOutMS: 845646,
            scope : 'userAuth',
        },
        {
            email: 'aaa@bbb.com',
            displayName: 'firstName4',
            ignoreTfa: true,
            password: '1234321',
            sessionTimeOutMS: 123454321,
            scope : 'userAuth',
        },
    ];

    public async getUsers(): Promise<User[]> {
        return this.mockUsers;
    }

    public async getUser(email: string): Promise<User> {
        for (const user of this.mockUsers) {
            if (user.email === email) {
                return user;
            }
        }
        throw new Error('user not exist');
    }

    public async createUser(newUser: User): Promise<void> {
        this.mockUsers.push(newUser);
    }

    public async deleteUser(user: User): Promise<void> {
        this.mockUsers.splice(this.mockUsers.indexOf(user), 1);
    }
}

const sessionDalMock = new SessionsDalMock();
const usersDalMock = new UsersDalMock();
const authBl = new AuthBl(new SessionsBl(sessionDalMock as unknown as SessionsDal),
    new UsersBl(usersDalMock as unknown as UsersDal));

describe('Authentication BL tests', () => {

    describe('Login to system', () => {
        it('it should login succsessfully', async () => {

            const expressResponseMock: unknown = {
                cookie: (sessionName: string, sessionKey: string, options: {}) => {
                    expect(sessionName).to.equal('session');
                    expect(sessionKey).to.be.a('string').length.above(60);
                    expect(options).to.be.deep.equal({
                        sameSite: true,
                        httpOnly: true, // minimize risk of XSS attacks by restricting the client from reading the cookie
                        secure: Configuration.http.useHttps, // only send cookie over https
                        maxAge: usersDalMock.mockUsers[0].sessionTimeOutMS,
                    });
                },
            };
            const pass = usersDalMock.mockUsers[0].password;
            const passHash = cryptoJs.SHA256(pass).toString();
            usersDalMock.mockUsers[0].password = passHash;
            await authBl.login(expressResponseMock as express.Response, {
                email: usersDalMock.mockUsers[0].email,
                password: pass,
            });

        });

        it('it should denied login', async () => {

            const expressResponseMock: unknown = {
                cookie: (sessionName: string, sessionKey: string, options: {}) => {
                    throw new Error('login request should be forbidden, the user name not exist');
                },
            };
            await authBl.login(expressResponseMock as express.Response, {
                email: (usersDalMock.mockUsers[0].email + 'ttt'),
                password: usersDalMock.mockUsers[0].password,
            })
                .catch((err) => {
                    const errorResponse: ErrorResponse = {
                        responseCode: 403,
                        message: 'user name or password incorrent',
                    };
                    expect(err).to.deep.equal(errorResponse);
                });
        });

        it('it should denied login', async () => {

            const expressResponseMock: unknown = {
                cookie: (sessionName: string, sessionKey: string, options: {}) => {
                    throw new Error('login request should be forbidden, the user passwrod incorrect');
                },
            };
            await authBl.login(expressResponseMock as express.Response, {
                email: usersDalMock.mockUsers[0].email,
                password: usersDalMock.mockUsers[0].password + 'ttt',
            })
                .catch((err) => {
                    const errorResponse: ErrorResponse = {
                        responseCode: 403,
                        message: 'user name or password incorrent',
                    };
                    expect(err).to.deep.equal(errorResponse);
                });
        });
    });
});
