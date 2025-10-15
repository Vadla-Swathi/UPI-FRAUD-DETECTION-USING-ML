document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.view-security-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const userId = this.getAttribute('data-user-id');
            const row = this.closest('tr');
            
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Loading...';
            this.disabled = true;
            
            try {
                const response = await fetch(`/admin/view-user-security/${userId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('modalUsername').value = data.username;
                    document.getElementById('modalEmail').value = data.email;
                    document.getElementById('modalCreatedAt').value = data.created_at;
                    document.getElementById('modalLastLogin').value = data.last_login;
                    document.getElementById('modalSecurityQuestion').value = data.security_question;
                    document.getElementById('modalSecurityAnswer').value = data.security_answer;
                    document.getElementById('modalPasswordHash').value = data.password_hash;
                    
                    const securityModal = new bootstrap.Modal(document.getElementById('securityModal'));
                    securityModal.show();
                } else {
                    alert(data.message || 'You do not have permission to view this data');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to load security details. Please check console for details.');
            } finally {
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    });
});
