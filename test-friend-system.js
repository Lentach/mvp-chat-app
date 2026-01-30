const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = (msg, color = colors.reset) => console.log(`${color}${msg}${colors.reset}`);

// Test data
const userA = {
  email: `test_user_a_${Date.now()}@example.com`,
  username: `userA_${Date.now()}`,
  password: 'password123',
};

const userB = {
  email: `test_user_b_${Date.now()}@example.com`,
  username: `userB_${Date.now()}`,
  password: 'password123',
};

let tokenA, tokenB, socketA, socketB;
let friendsListA = [];
let friendsListB = [];
let friendRequestsB = [];
let pendingCountB = 0;

async function registerUser(userData) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, userData);
    log(`✓ Registered: ${userData.email}`, colors.green);
    return response.data;
  } catch (error) {
    log(`✗ Failed to register ${userData.email}: ${error.response?.data?.message || error.message}`, colors.red);
    throw error;
  }
}

async function loginUser(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });
    log(`✓ Logged in: ${email}`, colors.green);
    return response.data.access_token;
  } catch (error) {
    log(`✗ Failed to login ${email}: ${error.response?.data?.message || error.message}`, colors.red);
    throw error;
  }
}

function connectSocket(token, userName) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      query: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      log(`✓ ${userName} connected to WebSocket`, colors.green);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      log(`✗ ${userName} failed to connect: ${error.message}`, colors.red);
      reject(error);
    });

    socket.on('error', (data) => {
      log(`⚠ ${userName} received error: ${data.message}`, colors.red);
    });
  });
}

function setupSocketListeners(socket, userName, lists) {
  socket.on('friendsList', (data) => {
    log(`📋 ${userName} received friendsList: ${JSON.stringify(data)}`, colors.cyan);
    lists.friends = data;
  });

  socket.on('friendRequestsList', (data) => {
    log(`📋 ${userName} received friendRequestsList: ${JSON.stringify(data)}`, colors.cyan);
    lists.requests = data;
  });

  socket.on('pendingRequestsCount', (data) => {
    log(`🔔 ${userName} pending count: ${data.count}`, colors.yellow);
    lists.pendingCount = data.count;
  });

  socket.on('friendRequestSent', (data) => {
    log(`✉️  ${userName} friend request sent: status=${data.status}`, colors.blue);
  });

  socket.on('newFriendRequest', (data) => {
    log(`📨 ${userName} received new friend request from ${data.sender.email}`, colors.blue);
  });

  socket.on('friendRequestAccepted', (data) => {
    log(`✅ ${userName} friend request accepted: ${data.sender.email} ↔ ${data.receiver.email}`, colors.green);
  });

  socket.on('friendRequestRejected', (data) => {
    log(`❌ ${userName} friend request rejected`, colors.red);
  });

  socket.on('conversationsList', (data) => {
    log(`💬 ${userName} received conversationsList: ${data.length} conversations`, colors.cyan);
  });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  log('\n========================================', colors.cyan);
  log('FRIEND REQUESTS SYSTEM TEST', colors.cyan);
  log('========================================\n', colors.cyan);

  try {
    // Step 1: Register users
    log('\n--- Step 1: Register Users ---', colors.yellow);
    await registerUser(userA);
    await registerUser(userB);
    await wait(500);

    // Step 2: Login users
    log('\n--- Step 2: Login Users ---', colors.yellow);
    tokenA = await loginUser(userA.email, userA.password);
    tokenB = await loginUser(userB.email, userB.password);
    await wait(500);

    // Step 3: Connect sockets
    log('\n--- Step 3: Connect WebSockets ---', colors.yellow);
    const listsA = { friends: [], requests: [], pendingCount: 0 };
    const listsB = { friends: [], requests: [], pendingCount: 0 };

    socketA = await connectSocket(tokenA, 'UserA');
    socketB = await connectSocket(tokenB, 'UserB');

    setupSocketListeners(socketA, 'UserA', listsA);
    setupSocketListeners(socketB, 'UserB', listsB);
    await wait(1000);

    // Step 4: Test - UserA sends friend request to UserB
    log('\n--- Step 4: UserA sends friend request to UserB ---', colors.yellow);
    socketA.emit('sendFriendRequest', { recipientEmail: userB.email });
    await wait(2000);

    // Step 5: Check if UserB received the request
    log('\n--- Step 5: Verify UserB received request ---', colors.yellow);
    if (listsB.pendingCount > 0) {
      log(`✓ TEST PASSED: UserB has ${listsB.pendingCount} pending request(s)`, colors.green);
    } else {
      log('✗ TEST FAILED: UserB should have pending requests but has 0', colors.red);
    }

    // Step 6: UserB accepts the friend request
    log('\n--- Step 6: UserB accepts friend request ---', colors.yellow);
    socketB.emit('getFriendRequests');
    await wait(1000);

    if (listsB.requests.length > 0) {
      const requestId = listsB.requests[0].id;
      log(`Accepting request ID: ${requestId}`, colors.blue);
      socketB.emit('acceptFriendRequest', { requestId });
      await wait(2000);
    }

    // Step 7: Verify both users see each other as friends
    log('\n--- Step 7: Verify friends lists ---', colors.yellow);
    socketA.emit('getFriends');
    socketB.emit('getFriends');
    await wait(2000);

    log(`\nUserA friends list: ${JSON.stringify(listsA.friends)}`, colors.cyan);
    log(`UserB friends list: ${JSON.stringify(listsB.friends)}`, colors.cyan);

    if (listsA.friends.length > 0 && listsB.friends.length > 0) {
      log('\n✓ TEST PASSED: Both users can see each other in friends list!', colors.green);
    } else {
      log('\n✗ TEST FAILED: Friends list is empty for one or both users', colors.red);
      log(`UserA friends count: ${listsA.friends.length}`, colors.red);
      log(`UserB friends count: ${listsB.friends.length}`, colors.red);
    }

    // Step 8: Test mutual friend request (auto-accept)
    log('\n--- Step 8: Test Mutual Friend Request (Auto-Accept) ---', colors.yellow);
    const userC = {
      email: `test_user_c_${Date.now()}@example.com`,
      username: `userC_${Date.now()}`,
      password: 'password123',
    };
    const userD = {
      email: `test_user_d_${Date.now()}@example.com`,
      username: `userD_${Date.now()}`,
      password: 'password123',
    };

    await registerUser(userC);
    await registerUser(userD);
    await wait(500);

    const tokenC = await loginUser(userC.email, userC.password);
    const tokenD = await loginUser(userD.email, userD.password);
    await wait(500);

    const listsC = { friends: [], requests: [], pendingCount: 0 };
    const listsD = { friends: [], requests: [], pendingCount: 0 };

    const socketC = await connectSocket(tokenC, 'UserC');
    const socketD = await connectSocket(tokenD, 'UserD');

    setupSocketListeners(socketC, 'UserC', listsC);
    setupSocketListeners(socketD, 'UserD', listsD);
    await wait(1000);

    // UserC sends request to UserD
    log('UserC sends friend request to UserD...', colors.blue);
    socketC.emit('sendFriendRequest', { recipientEmail: userD.email });
    await wait(1000);

    // UserD sends request to UserC (should auto-accept both)
    log('UserD sends friend request to UserC (should auto-accept)...', colors.blue);
    socketD.emit('sendFriendRequest', { recipientEmail: userC.email });
    await wait(2000);

    // Check friends lists
    socketC.emit('getFriends');
    socketD.emit('getFriends');
    await wait(2000);

    log(`\nUserC friends list: ${JSON.stringify(listsC.friends)}`, colors.cyan);
    log(`UserD friends list: ${JSON.stringify(listsD.friends)}`, colors.cyan);

    if (listsC.friends.length > 0 && listsD.friends.length > 0) {
      log('\n✓ TEST PASSED: Mutual request auto-accepted! Both users are friends.', colors.green);
    } else {
      log('\n✗ TEST FAILED: Mutual auto-accept did not work', colors.red);
    }

    // Cleanup
    socketC.disconnect();
    socketD.disconnect();

    log('\n========================================', colors.cyan);
    log('TEST SUMMARY', colors.cyan);
    log('========================================', colors.cyan);
    log(`✓ Standard accept flow: ${listsA.friends.length > 0 && listsB.friends.length > 0 ? 'PASSED' : 'FAILED'}`,
         listsA.friends.length > 0 && listsB.friends.length > 0 ? colors.green : colors.red);
    log(`✓ Mutual auto-accept: ${listsC.friends.length > 0 && listsD.friends.length > 0 ? 'PASSED' : 'FAILED'}`,
         listsC.friends.length > 0 && listsD.friends.length > 0 ? colors.green : colors.red);

  } catch (error) {
    log(`\n✗ TEST ERROR: ${error.message}`, colors.red);
    console.error(error);
  } finally {
    // Cleanup
    if (socketA) socketA.disconnect();
    if (socketB) socketB.disconnect();
    log('\n✓ Disconnected all sockets', colors.yellow);
    process.exit(0);
  }
}

// Run tests
runTests();
