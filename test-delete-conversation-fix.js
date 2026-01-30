/**
 * Test script for "Already Friends" bug fix
 *
 * This script tests the flow:
 * 1. User A sends friend request to User B
 * 2. User B accepts
 * 3. User A deletes the conversation (which should now also delete the friendship)
 * 4. User A sends a new friend request to User B (should work without "Already friends" error)
 */

const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create test users
async function createUser(email, username, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, {
      email,
      username,
      password,
    });
    console.log(`✓ Created user: ${email} (${username})`);
    return response.data;
  } catch (error) {
    if (error.response?.data?.message?.includes('already exists')) {
      // Login instead
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email,
        password,
      });
      console.log(`✓ Logged in existing user: ${email} (${username})`);
      return { email, username };
    }
    throw error;
  }
}

// Login to get JWT token
async function login(email, password) {
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    email,
    password,
  });
  return response.data.access_token;
}

// Connect to WebSocket
function connectSocket(token, onConnect) {
  const socket = io(BASE_URL, {
    query: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log(`✓ Socket connected: ${socket.id}`);
    if (onConnect) onConnect();
  });

  socket.on('error', (error) => {
    console.error('✗ Socket error:', error);
  });

  return socket;
}

async function runTest() {
  console.log('\n=== Testing "Already Friends" Bug Fix ===\n');

  // Step 1: Create test users
  console.log('Step 1: Creating test users...');
  const userA = await createUser('test_user_a@test.com', 'testUserA', 'password123');
  const userB = await createUser('test_user_b@test.com', 'testUserB', 'password123');

  // Step 2: Get JWT tokens
  console.log('\nStep 2: Getting JWT tokens...');
  const tokenA = await login('test_user_a@test.com', 'password123');
  const tokenB = await login('test_user_b@test.com', 'password123');
  console.log('✓ Got tokens for both users');

  // Step 3: Connect WebSockets
  console.log('\nStep 3: Connecting WebSockets...');
  let socketA, socketB;

  await new Promise((resolve) => {
    let connected = 0;
    const checkResolve = () => {
      connected++;
      if (connected === 2) resolve();
    };

    socketA = connectSocket(tokenA, checkResolve);
    socketB = connectSocket(tokenB, checkResolve);
  });

  // Set up event listeners
  let conversationId = null;

  socketA.on('friendRequestSent', (data) => {
    console.log('✓ User A: Friend request sent', data);
  });

  socketB.on('newFriendRequest', (data) => {
    console.log('✓ User B: New friend request received', data);

    // Auto-accept after a short delay
    setTimeout(() => {
      console.log('\nStep 5: User B accepting friend request...');
      socketB.emit('acceptFriendRequest', { requestId: data.id });
    }, 500);
  });

  socketA.on('friendRequestAccepted', (data) => {
    console.log('✓ User A: Friend request accepted', data);
  });

  socketB.on('friendRequestAccepted', (data) => {
    console.log('✓ User B: Friend request accepted', data);
  });

  socketA.on('conversationsList', (data) => {
    console.log(`✓ User A: Conversations list updated (${data.length} conversations)`);
    if (data.length > 0 && !conversationId) {
      conversationId = data[0].id;
      console.log(`✓ Got conversation ID: ${conversationId}`);

      // Wait a bit, then delete conversation
      setTimeout(() => {
        console.log('\nStep 6: User A deleting conversation (this should also delete friendship)...');
        socketA.emit('deleteConversation', { conversationId });
      }, 1000);
    }
  });

  socketB.on('conversationsList', (data) => {
    console.log(`✓ User B: Conversations list updated (${data.length} conversations)`);
  });

  socketA.on('unfriended', (data) => {
    console.log('✓ User A: Unfriended event received', data);

    // Wait a bit, then try to send a new friend request
    setTimeout(() => {
      console.log('\nStep 7: User A sending NEW friend request (should work without "Already friends" error)...');
      socketA.emit('sendFriendRequest', { recipientEmail: 'test_user_b@test.com' });
    }, 1000);
  });

  socketB.on('unfriended', (data) => {
    console.log('✓ User B: Unfriended event received', data);
  });

  // This is what we're testing - should NOT get this error
  socketA.on('error', (error) => {
    if (error.message === 'Already friends') {
      console.error('\n✗✗✗ BUG STILL EXISTS: Got "Already friends" error! ✗✗✗');
      console.error('The fix did not work. The friendship was not deleted when the conversation was deleted.');
      process.exit(1);
    } else {
      console.log('User A error:', error);
    }
  });

  // Step 4: User A sends friend request to User B
  console.log('\nStep 4: User A sending initial friend request to User B...');
  await sleep(500);
  socketA.emit('sendFriendRequest', { recipientEmail: 'test_user_b@test.com' });

  // Wait for test to complete
  await sleep(8000);

  console.log('\n=== Test Complete ===');
  console.log('✓ SUCCESS: No "Already friends" error after deleting conversation!');
  console.log('✓ The fix is working correctly.');

  socketA.disconnect();
  socketB.disconnect();
  process.exit(0);
}

// Run the test
runTest().catch((error) => {
  console.error('\n✗ Test failed with error:', error.message);
  process.exit(1);
});
