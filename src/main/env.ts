import 'dotenv/config'

const envFileRootDir = process.env.FILE_ROOT_DIR

if (!envFileRootDir) {
    throw new Error('FILE_ROOT_DIR is not set. Add it to .env (e.g. FILE_ROOT_DIR=./data)')
}

export const FILE_ROOT_DIR: string = envFileRootDir
