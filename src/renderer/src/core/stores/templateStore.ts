import { defineStore } from 'pinia'

// Define types for our user state
interface User {
    id: number
    name: string
    email: string
}

interface UserState {
    users: User[]
    currentUser: User | null
    loading: boolean
    error: string | null
}

export const useUserStore = defineStore('userStore', {
    state: (): UserState => ({
        users: [],
        currentUser: null,
        loading: false,
        error: null
    }),

    getters: {
        // Getter with parameter
        getUserById: (state) => (id: number) => {
            return state.users.find((user) => user.id === id)
        },

        // Regular getter
        activeUsers: (state) => {
            return state.users.filter((user) => !user.email.endsWith('.inactive'))
        },

        // Getter that uses another getter
        activeUserCount(): number {
            return this.activeUsers.length
        }
    },

    actions: {
        async fetchUsers() {
            try {
                this.loading = true
                this.error = null

                // Simulate API call
                await new Promise<User[]>((resolve) => {
                    setTimeout(() => {
                        resolve([
                            { id: 1, name: 'John Doe', email: 'john@example.com' },
                            { id: 2, name: 'Jane Smith', email: 'jane@example.com.inactive' },
                            { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
                        ])
                    }, 1000)
                })

                this.users = response
            } catch (error) {
                this.error = error instanceof Error ? error.message : 'Failed to fetch users'
            } finally {
                this.loading = false
            }
        },

        async addUser(user: Omit<User, 'id'>) {
            try {
                this.loading = true

                // Simulate API call
                const newUser = await new Promise<User>((resolve) => {
                    setTimeout(() => {
                        resolve({
                            id: Math.max(0, ...this.users.map((u) => u.id)) + 1,
                            ...user
                        })
                    }, 500)
                })

                this.users.push(newUser)
                return newUser
            } catch (error) {
                this.error = error instanceof Error ? error.message : 'Failed to add user'
                return null
            } finally {
                this.loading = false
            }
        },

        setCurrentUser(user: User | null) {
            this.currentUser = user
        }
    }
})
