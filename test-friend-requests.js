const http = require('http');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'http://localhost:3000';

// Helper to make HTTP requests
function httpRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Test scenarios
async function runTests() {
  console.log('🧪 Friend Requests System Tests\n');

  try {
    // TEST 1: Create accounts
    console.log('1️⃣  Creating test accounts...');
    const alice = await httpRequest('POST', '/auth/register', {
      email: 'alice@test.com',
      username: 'Alice',
      password: 'password123',
    });
    console.log('   ✅ Alice created:', alice.email, `(ID: ${alice.id})`);

    const bob = await httpRequest('POST', '/auth/register', {
      email: 'bob@test.com',
      username: 'Bob',
      password: 'password123',
    });
    console.log('   ✅ Bob created:', bob.email, `(ID: ${bob.id})`);

    // TEST 2: Login and get tokens
    console.log('\n2️⃣  Logging in...');
    const aliceLogin = await httpRequest('POST', '/auth/login', {
      email: 'alice@test.com',
      password: 'password123',
    });
    const aliceToken = aliceLogin.access_token;
    console.log('   ✅ Alice token:', aliceToken.substring(0, 20) + '...');

    const bobLogin = await httpRequest('POST', '/auth/login', {
      email: 'bob@test.com',
      password: 'password123',
    });
    const bobToken = bobLogin.access_token;
    console.log('   ✅ Bob token:', bobToken.substring(0, 20) + '...');

    // TEST 3: Connect WebSockets
    console.log('\n3️⃣  Connecting WebSocket clients...');
    const aliceSocket = io(WS_URL, {
      query: { token: aliceToken },
      transports: ['websocket'],
    });
    const bobSocket = io(WS_URL, {
      query: { token: bobToken },
      transports: ['websocket'],
    });

    await new Promise((resolve) => {
      let connected = 0;
      aliceSocket.on('connect', () => {
        console.log('   ✅ Alice connected');
        if (++connected === 2) resolve();
      });
      bobSocket.on('connect', () => {
        console.log('   ✅ Bob connected');
        if (++connected === 2) resolve();
      });
      setTimeout(() => resolve(), 3000);
    });

    // TEST 4: Send friend request Alice -> Bob
    console.log('\n4️⃣  Alice sends friend request to Bob...');
    await new Promise((resolve) => {
      let received = false;
      bobSocket.once('newFriendRequest', (request) => {
        console.log('   ✅ Bob received friend request:', {
          from: request.sender.email,
          status: request.status,
        });
        received = true;
        resolve();
      });

      aliceSocket.emit('sendFriendRequest', { recipientEmail: 'bob@test.com' });
      setTimeout(() => {
        if (!received) console.log('   ⚠️  Timeout (Bob may not be online)');
        resolve();
      }, 2000);
    });

    // TEST 5: Bob gets pending requests
    console.log('\n5️⃣  Bob fetches friend requests...');
    await new Promise((resolve) => {
      bobSocket.once('friendRequestsList', (requests) => {
        console.log('   ✅ Bob received requests:', requests.length, 'pending');
        if (requests.length > 0) {
          console.log('      From:', requests[0].sender.email);
          console.log('      Status:', requests[0].status);
        }
        resolve();
      });
      bobSocket.emit('getFriendRequests');
      setTimeout(() => resolve(), 2000);
    });

    // TEST 6: Bob accepts friend request
    console.log('\n6️⃣  Bob accepts friend request...');
    let requestId = null;
    await new Promise((resolve) => {
      bobSocket.once('friendRequestsList', (requests) => {
        if (requests.length > 0) {
          requestId = requests[0].id;
          bobSocket.emit('acceptFriendRequest', { requestId });
        }
        resolve();
      });
      bobSocket.emit('getFriendRequests');
      setTimeout(() => resolve(), 1000);
    });

    if (requestId) {
      await new Promise((resolve) => {
        bobSocket.once('friendRequestAccepted', (request) => {
          console.log('   ✅ Bob accepted request from:', request.sender.email);
          resolve();
        });
        setTimeout(() => resolve(), 2000);
      });
    }

    // TEST 7: Both get friends list
    console.log('\n7️⃣  Both users fetch friends list...');
    await new Promise((resolve) => {
      aliceSocket.once('friendsList', (friends) => {
        console.log('   ✅ Alice friends:', friends.length);
        if (friends.length > 0) console.log('      -', friends[0].email);
      });
      aliceSocket.emit('getFriends');
      setTimeout(() => resolve(), 2000);
    });

    await new Promise((resolve) => {
      bobSocket.once('friendsList', (friends) => {
        console.log('   ✅ Bob friends:', friends.length);
        if (friends.length > 0) console.log('      -', friends[0].email);
      });
      bobSocket.emit('getFriends');
      setTimeout(() => resolve(), 2000);
    });

    // TEST 8: Send message (should succeed - they're friends)
    console.log('\n8️⃣  Alice sends message to Bob (should work - friends)...');
    await new Promise((resolve) => {
      bobSocket.once('newMessage', (msg) => {
        console.log('   ✅ Bob received message:', msg.content);
      });
      aliceSocket.once('messageSent', (msg) => {
        console.log('   ✅ Alice sent message:', msg.content);
      });

      aliceSocket.emit('sendMessage', { recipientId: bob.id, content: 'Hello Bob!' });
      setTimeout(() => resolve(), 2000);
    });

    // TEST 9: Create new account (not friends) and try to send message
    console.log('\n9️⃣  Creating Charlie (not friends with Alice)...');
    const charlie = await httpRequest('POST', '/auth/register', {
      email: 'charlie@test.com',
      username: 'Charlie',
      password: 'password123',
    });
    console.log('   ✅ Charlie created:', charlie.email);

    const charlieLogin = await httpRequest('POST', '/auth/login', {
      email: 'charlie@test.com',
      password: 'password123',
    });
    const charlieSocket = io(WS_URL, {
      query: { token: charlieLogin.access_token },
      transports: ['websocket'],
    });

    await new Promise((resolve) => {
      charlieSocket.on('connect', () => {
        console.log('   ✅ Charlie connected');
        resolve();
      });
      setTimeout(() => resolve(), 2000);
    });

    // TEST 10: Alice tries to message Charlie (should fail - not friends)
    console.log('\n🔟 Alice tries to send message to Charlie (should fail)...');
    await new Promise((resolve) => {
      aliceSocket.once('error', (err) => {
        if (err.message && err.message.includes('friends')) {
          console.log('   ✅ Blocked correctly:', err.message);
        } else {
          console.log('   ⚠️  Error:', err.message);
        }
      });
      aliceSocket.emit('sendMessage', { recipientId: charlie.id, content: 'Hi Charlie!' });
      setTimeout(() => resolve(), 2000);
    });

    // TEST 11: Unfriend
    console.log('\n1️⃣1️⃣  Alice unfriends Bob...');
    await new Promise((resolve) => {
      aliceSocket.once('unfriended', (data) => {
        console.log('   ✅ Alice unfriended:', data.userId);
      });
      aliceSocket.emit('unfriend', { userId: bob.id });
      setTimeout(() => resolve(), 2000);
    });

    // TEST 12: Try message after unfriend (should fail)
    console.log('\n1️⃣2️⃣  Alice tries to message Bob after unfriend (should fail)...');
    await new Promise((resolve) => {
      aliceSocket.once('error', (err) => {
        console.log('   ✅ Blocked correctly:', err.message);
      });
      aliceSocket.emit('sendMessage', { recipientId: bob.id, content: 'Hey!' });
      setTimeout(() => resolve(), 2000);
    });

    // Close connections
    aliceSocket.close();
    bobSocket.close();
    charlieSocket.close();

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
