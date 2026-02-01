/**
 * Complete test for "Already Friends" bug fix
 * Tests the full cycle: request → accept → delete → request again
 */

const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createUser(email, username, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, { email, username, password });
    console.log(`✓ Created user: ${email}`);
    return response.data;
  } catch (error) {
    if (error.response?.data?.message?.includes('already exists')) {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, { email, password });
      console.log(`✓ Logged in existing user: ${email}`);
      return { email, username };
    }
    throw error;
  }
}

async function login(email, password) {
  const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });
  return response.data.access_token;
}

function connectSocket(token) {
  return new Promise((resolve) => {
    const socket = io(BASE_URL, {
      query: { token },
      transports: ['websocket'],
    });
    socket.on('connect', () => {
      console.log(`✓ Socket connected: ${socket.id}`);
      resolve(socket);
    });
    socket.on('error', (error) => console.error('Socket error:', error));
  });
}

async function runTest() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  Testing "Already Friends" Bug Fix - FULL    ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  // Setup
  console.log('📋 Step 1: Setup test users...');
  await createUser('test_flow_a@test.com', 'testFlowA', 'password123');
  await createUser('test_flow_b@test.com', 'testFlowB', 'password123');

  const tokenA = await login('test_flow_a@test.com', 'password123');
  const tokenB = await login('test_flow_b@test.com', 'password123');
  console.log('✓ Got JWT tokens\n');

  const socketA = await connectSocket(tokenA);
  const socketB = await connectSocket(tokenB);
  console.log('✓ WebSockets connected\n');

  // Track state
  let conversationId = null;
  let step = 1;

  // User A: Send initial friend request
  console.log(`🚀 Step ${step++}: User A sends friend request to User B...`);
  socketA.emit('sendFriendRequest', { recipientEmail: 'test_flow_b@test.com' });

  await new Promise((resolve) => {
    socketB.once('newFriendRequest', (data) => {
      console.log(`✓ User B received friend request (id=${data.id})\n`);

      // User B: Accept the request
      console.log(`✅ Step ${step++}: User B accepts friend request...`);
      socketB.emit('acceptFriendRequest', { requestId: data.id });

      socketA.once('conversationsList', (conversations) => {
        if (conversations.length > 0) {
          conversationId = conversations[0].id;
          console.log(`✓ Conversation created (id=${conversationId})\n`);

          // User A: Delete the conversation (should also delete friendship)
          setTimeout(() => {
            console.log(`🗑️  Step ${step++}: User A deletes conversation (should delete friendship too)...`);
            socketA.emit('deleteConversation', { conversationId });

            socketA.once('conversationsList', (conversations) => {
              console.log(`✓ User A: Conversation deleted (${conversations.length} conversations remaining)\n`);

              // Wait for unfriend to complete, then send new request
              setTimeout(() => {
                console.log(`🔄 Step ${step++}: User A sends NEW friend request (testing the fix)...`);

                // This is the critical test - should NOT fail with "Already friends"
                let errorReceived = false;

                socketA.once('error', (error) => {
                  if (error.message === 'Already friends') {
                    console.error('\n❌❌❌ BUG DETECTED! ❌❌❌');
                    console.error('Got "Already friends" error after deleting conversation!');
                    console.error('The friendship was not properly deleted.\n');
                    errorReceived = true;
                    socketA.disconnect();
                    socketB.disconnect();
                    process.exit(1);
                  }
                });

                socketA.once('friendRequestSent', (data) => {
                  if (!errorReceived) {
                    console.log(`✓ User A: New friend request sent successfully (id=${data.id})`);
                    console.log('\n╔═══════════════════════════════════════════════╗');
                    console.log('║  ✅ TEST PASSED! FIX WORKS CORRECTLY! ✅     ║');
                    console.log('╚═══════════════════════════════════════════════╝');
                    console.log('\nVerified:');
                    console.log('  ✓ Friend request sent');
                    console.log('  ✓ Friend request accepted');
                    console.log('  ✓ Conversation deleted');
                    console.log('  ✓ Friendship also deleted (no "Already friends" error)');
                    console.log('  ✓ New friend request sent successfully\n');

                    socketA.disconnect();
                    socketB.disconnect();
                    process.exit(0);
                  }
                });

                socketA.emit('sendFriendRequest', { recipientEmail: 'test_flow_b@test.com' });

                // Timeout check
                setTimeout(() => {
                  if (!errorReceived) {
                    console.log('\n⚠️  Timeout waiting for response. Check backend logs.');
                    socketA.disconnect();
                    socketB.disconnect();
                    process.exit(1);
                  }
                }, 3000);
              }, 1000);
            });
          }, 1000);
        }
      });
    });
  });
}

runTest().catch((error) => {
  console.error('\n✗ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
