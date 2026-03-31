from collections import deque

class Queue:
    def __init__(self):
        self.q = deque()

    def enqueue(self, val):
        self.q.append(val)        # add to right

    def dequeue(self):
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.q.popleft()   # remove from left — O(1)

    def peek(self):
        return self.q[0] if self.q else None

    def is_empty(self):
        return len(self.q) == 0

    def size(self):
        return len(self.q)

    def __str__(self):
        return f"Queue({list(self.q)})"

# Usage
q = Queue()
q.enqueue(1)
q.enqueue(2)
q.enqueue(3)
print(q) 
print(q.dequeue())   # 1 — FIFO
print(q.peek())      # 2
print(q)             # Queue([2, 3])